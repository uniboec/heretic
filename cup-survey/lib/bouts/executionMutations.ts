import { Prisma } from '@prisma/client'
import { tournamentInfo, TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { prisma } from '../prisma'
import { loadScheduleSnapshot, buildScheduledMats } from './scheduleService'
import { lockMatScheduleRuntimeRows } from './locks'
import { executeScheduleMutation } from './executeScheduleMutation'
import { freezeScheduleNumberIfNeeded } from './freezeScheduleNumber'
import {
  InvalidBoutExecutionStateError,
  UndoWhileBoutInProgressError,
} from './errors'
import { classifyMatExecutions } from './getMatExecutionState'
import { cleanupEmptyExecutionsIfNotStarted } from './executionGuards'
import {
  assertCanCompleteBout,
  assertCanStartBout,
} from './executionValidation'
import {
  assertStageGateAllowsStart,
  buildStageGatePlannedContext,
} from './stageGateValidation'

async function loadMatScheduleContext(
  tx: Prisma.TransactionClient,
  matIndex: number,
  mutationNow: Date,
) {
  const snapshot = await loadScheduleSnapshot(tx)
  const { getGroupedBoutsForSchedule } = await import('./schedulePipeline')
  const grouped = await getGroupedBoutsForSchedule(tx, snapshot.settings.matCount)
  const matGroup = grouped.mats.find((mat) => mat.matIndex === matIndex)
  if (!matGroup) {
    throw new Error(`Mat ${matIndex} not found`)
  }

  const { buildScheduleOverridesFromPairs } = await import('./schedulePipeline')
  const { getActivePublishedGeneration, getCurrentPublishedDraws } = await import(
    '../brackets/generation/publishedDraws'
  )
  const published = await getActivePublishedGeneration(tx)
  if (published) {
    const pairs = await getCurrentPublishedDraws({ db: tx, activeGeneration: published })
    snapshot.scheduleOverrides = buildScheduleOverridesFromPairs(pairs, grouped)
  }

  const executions = new Map(
    snapshot.executions.map((execution) => [execution.boutId, execution]),
  )
  const { mats } = buildScheduledMats({
    grouped,
    snapshot,
    now: mutationNow,
  })
  const matSchedule = mats.find((mat) => mat.matIndex === matIndex)
  if (!matSchedule) {
    throw new Error(`Mat ${matIndex} schedule not found`)
  }
  const allBouts = mats.flatMap((mat) => mat.bouts)
  const plannedCtx = buildStageGatePlannedContext({
    allBouts,
    pageSettings: snapshot.settings,
    eventDate: tournamentInfo.eventDate,
  })

  return {
    snapshot,
    matGroup,
    executions,
    schedule: matSchedule.bouts,
    allBouts,
    plannedCtx,
  }
}

export async function startBoutExecution(input: {
  boutId: string
  matIndex: number
  mutationId: string
  expectedScheduleVersion: number
}) {
  const mutationNow = new Date()

  const result = await executeScheduleMutation({
    mutationId: input.mutationId,
    boutId: input.boutId,
    command: 'START',
    payload: { matIndex: input.matIndex },
    actorId: null,
    expectedScheduleVersion: input.expectedScheduleVersion,
    execute: async (tx) => {
      await lockMatScheduleRuntimeRows(tx, [input.matIndex])

      const { snapshot, matGroup, executions, schedule, allBouts, plannedCtx } =
        await loadMatScheduleContext(tx, input.matIndex, mutationNow)

      await cleanupEmptyExecutionsIfNotStarted(tx, snapshot.executions)

      const classification = classifyMatExecutions(matGroup.bouts, executions)
      const bout = schedule.find((entry) => entry.id === input.boutId)
      if (!bout) {
        throw new Error(`Bout ${input.boutId} not found on mat ${input.matIndex}`)
      }

      assertStageGateAllowsStart({
        bout,
        allBoutsOnAllMats: allBouts,
        plannedCtx,
        pageSettings: snapshot.settings,
        eventDate: tournamentInfo.eventDate,
        mutationNow,
      })

      assertCanStartBout({
        schedule,
        boutId: input.boutId,
        mutationNow,
        inProgressId: classification.inProgressId,
      })

      const scheduled = buildScheduledMats({
        grouped: await (async () => {
          const { getGroupedBoutsForSchedule } = await import('./schedulePipeline')
          return getGroupedBoutsForSchedule(tx, snapshot.settings.matCount)
        })(),
        snapshot,
        now: mutationNow,
      })

      const freeze = await freezeScheduleNumberIfNeeded(tx, input.boutId, {
        matsEnabled: snapshot.settings.matsEnabled,
        mats: scheduled.mats,
        executions,
      })

      await tx.boutScheduleExecution.upsert({
        where: { boutId: input.boutId },
        create: {
          boutId: input.boutId,
          tournamentScopeId: TOURNAMENT_SCOPE_ID,
          actualStartAt: mutationNow,
          frozenScheduleFormatted: freeze.formatted,
          frozenScheduleMatNumber: freeze.matNumber,
          frozenSchedulePosition: freeze.position,
        },
        update: {
          actualStartAt: mutationNow,
          actualEndAt: null,
          frozenScheduleFormatted: freeze.formatted,
          frozenScheduleMatNumber: freeze.matNumber,
          frozenSchedulePosition: freeze.position,
        },
      })

      return {
        result: {
          ok: true as const,
          boutId: input.boutId,
          actualStartAt: mutationNow.toISOString(),
          scheduleDisplayNumber: freeze.formatted,
        },
        changed: true,
      }
    },
  })

  const { scheduleMatAnnouncerSync } = await import('../announcer/hooks/scheduleMatSync')
  scheduleMatAnnouncerSync()
  return result
}

export async function completeBoutExecution(input: { boutId: string; matIndex: number }) {
  const result = await prisma.$transaction(
    async (tx) => {
      await lockBoutsPageSetting(tx)
      await lockMatScheduleRuntimeRows(tx, [input.matIndex])
      const mutationNow = new Date()

      const { schedule } = await loadMatScheduleContext(tx, input.matIndex, mutationNow)

      const execution = await tx.boutScheduleExecution.findUnique({
        where: { boutId: input.boutId },
      })
      if (!execution?.actualStartAt) {
        throw new InvalidBoutExecutionStateError('NO_START')
      }

      assertCanCompleteBout({
        schedule,
        boutId: input.boutId,
        mutationNow,
        actualStartAt: execution.actualStartAt,
      })

      await tx.boutScheduleExecution.update({
        where: { boutId: input.boutId },
        data: { actualEndAt: mutationNow },
      })

      return { ok: true as const, boutId: input.boutId, actualEndAt: mutationNow.toISOString() }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  )

  const { scheduleMatAnnouncerSync } = await import('../announcer/hooks/scheduleMatSync')
  scheduleMatAnnouncerSync()
  return result
}

export async function undoBoutCompletion(input: { boutId: string; matIndex: number }) {
  const result = await prisma.$transaction(
    async (tx) => {
      await lockBoutsPageSetting(tx)
      await lockMatScheduleRuntimeRows(tx, [input.matIndex])
      const snapshot = await loadScheduleSnapshot(tx)
      const { getGroupedBoutsForSchedule } = await import('./schedulePipeline')
      const grouped = await getGroupedBoutsForSchedule(tx, snapshot.settings.matCount)
      const matGroup = grouped.mats.find((mat) => mat.matIndex === input.matIndex)
      if (!matGroup) {
        throw new Error(`Mat ${input.matIndex} not found`)
      }

      const executions = new Map(
        snapshot.executions.map((execution) => [execution.boutId, execution]),
      )
      const classification = classifyMatExecutions(matGroup.bouts, executions)

      if (classification.inProgressId) {
        throw new UndoWhileBoutInProgressError()
      }

      const lastCompletedId = classification.completedIds.at(-1)
      if (!lastCompletedId || lastCompletedId !== input.boutId) {
        throw new UndoWhileBoutInProgressError('Можно отменить только последний завершённый бой')
      }

      await tx.boutScheduleExecution.update({
        where: { boutId: input.boutId },
        data: { actualEndAt: null },
      })

      return { ok: true as const, boutId: input.boutId }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  )

  const { scheduleMatAnnouncerSync } = await import('../announcer/hooks/scheduleMatSync')
  scheduleMatAnnouncerSync()
  return result
}
