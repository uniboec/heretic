import type { PrismaClient } from '@prisma/client'
import { prisma } from '../prisma'
import {
  assertCompletedBoutHasFrozenNumber,
  type FreezeScheduleSnapshot,
} from './freezeScheduleNumber'
import {
  assertFrozenPrefixInvariant,
  assertScheduleContiguity,
  assertScheduleUniqueness,
  buildDynamicScheduleDisplayNumber,
  computeScheduleDisplayNumbers,
  frozenNumberFromExecution,
  isStaleLegacyFrozenDisplay,
  type ScheduleDisplayNumber,
  type ScheduleQueueEntry,
} from './scheduleDisplayNumber'
import { buildScheduledMats, loadFullScheduleSnapshot } from './scheduleService'
import { lockBoutsPageSetting } from './locks'
import type { ScheduleExecutionRecord, ScheduledBout } from './scheduleTypes'

export type RebuildLegacyFrozenScheduleNumbersResult = {
  dryRun: boolean
  scheduleLegacyGapBefore: boolean
  scheduleLegacyGapAfter: boolean
  repairedCount: number
  backfilledMissingCount: number
  repairedBoutIds: string[]
  backfilledMissingBoutIds: string[]
  invariantOk: boolean
  invariantError: string | null
  frozenPrefixOk: boolean
  frozenPrefixError: string | null
}

type ExecutionRow = {
  boutId: string
  actualStartAt: Date | null
  actualEndAt: Date | null
  frozenScheduleFormatted: string | null
  frozenScheduleMatNumber: number | null
  frozenSchedulePosition: number | null
}

function boutRequiresFrozenNumber(execution: ExecutionRow): boolean {
  return execution.actualStartAt != null || execution.actualEndAt != null
}

function toExecutionRecord(row: ExecutionRow): ScheduleExecutionRecord {
  return {
    boutId: row.boutId,
    actualStartAt: row.actualStartAt,
    actualEndAt: row.actualEndAt,
    frozenScheduleFormatted: row.frozenScheduleFormatted,
    frozenScheduleMatNumber: row.frozenScheduleMatNumber,
    frozenSchedulePosition: row.frozenSchedulePosition,
  }
}

function collectQueuedBouts(
  mats: Array<{ matIndex: number; bouts: ScheduledBout[] }>,
  matsEnabled: boolean,
): Array<{ boutId: string; matIndex: number; position: number }> {
  if (matsEnabled) {
    return mats.flatMap((mat) => {
      let position = 0
      return mat.bouts.map((bout) => {
        position += 1
        return { boutId: bout.id, matIndex: mat.matIndex, position }
      })
    })
  }

  const globalBouts = mats
    .flatMap((mat) =>
      mat.bouts.map((bout) => ({
        boutId: bout.id,
        matIndex: mat.matIndex,
        estimatedStartAt: bout.timing.estimatedStartAt,
      })),
    )
    .sort((left, right) => {
      if (left.estimatedStartAt !== right.estimatedStartAt) {
        return left.estimatedStartAt.localeCompare(right.estimatedStartAt)
      }
      if (left.matIndex !== right.matIndex) {
        return left.matIndex - right.matIndex
      }
      return left.boutId.localeCompare(right.boutId)
    })

  return globalBouts.map((entry, index) => ({
    boutId: entry.boutId,
    matIndex: entry.matIndex,
    position: index + 1,
  }))
}

function planRebuild(input: {
  mats: Array<{ matIndex: number; bouts: ScheduledBout[] }>
  matsEnabled: boolean
  executions: ExecutionRow[]
}): {
  updates: Map<string, ScheduleDisplayNumber>
  repairedBoutIds: string[]
  backfilledMissingBoutIds: string[]
} {
  const executionById = new Map(input.executions.map((row) => [row.boutId, row]))
  const updates = new Map<string, ScheduleDisplayNumber>()
  const repairedBoutIds: string[] = []
  const backfilledMissingBoutIds: string[] = []

  for (const queued of collectQueuedBouts(input.mats, input.matsEnabled)) {
    const execution = executionById.get(queued.boutId)
    if (!execution || !boutRequiresFrozenNumber(execution)) {
      continue
    }

    const target = buildDynamicScheduleDisplayNumber({
      matIndex: queued.matIndex,
      position: queued.position,
      matsEnabled: input.matsEnabled,
    })
    const frozen = frozenNumberFromExecution(toExecutionRecord(execution))
    const needsBackfill = !frozen
    const needsRepair =
      frozen != null &&
      isStaleLegacyFrozenDisplay({
        frozen,
        matIndex: queued.matIndex,
        position: queued.position,
        matsEnabled: input.matsEnabled,
      })

    if (!needsBackfill && !needsRepair) {
      continue
    }

    updates.set(queued.boutId, target)
    if (needsBackfill) {
      backfilledMissingBoutIds.push(queued.boutId)
    } else {
      repairedBoutIds.push(queued.boutId)
    }
  }

  return { updates, repairedBoutIds, backfilledMissingBoutIds }
}

function buildFrozenQueues(
  mats: Array<{ matIndex: number; bouts: ScheduledBout[] }>,
  matsEnabled: boolean,
  executionMap: Map<string, ScheduleExecutionRecord>,
): ScheduleQueueEntry[][] {
  if (matsEnabled) {
    return mats.map((mat) =>
      mat.bouts.map((bout) => {
        const execution = executionMap.get(bout.id)
        const frozen = execution ? frozenNumberFromExecution(execution) : null
        return {
          boutId: bout.id,
          matIndex: mat.matIndex,
          isFrozen: frozen != null,
          frozen,
        }
      }),
    )
  }

  const globalBouts = mats
    .flatMap((mat) => mat.bouts.map((bout) => ({ bout, matIndex: mat.matIndex })))
    .sort((left, right) => {
      const leftStart = left.bout.timing.estimatedStartAt
      const rightStart = right.bout.timing.estimatedStartAt
      if (leftStart !== rightStart) {
        return leftStart.localeCompare(rightStart)
      }
      if (left.matIndex !== right.matIndex) {
        return left.matIndex - right.matIndex
      }
      return left.bout.id.localeCompare(right.bout.id)
    })

  return [
    globalBouts.map((entry) => {
      const execution = executionMap.get(entry.bout.id)
      const frozen = execution ? frozenNumberFromExecution(execution) : null
      return {
        boutId: entry.bout.id,
        matIndex: entry.matIndex,
        isFrozen: frozen != null,
        frozen,
      }
    }),
  ]
}

function validateScheduleInvariants(input: {
  mats: Array<{ matIndex: number; bouts: ScheduledBout[] }>
  matsEnabled: boolean
  executions: ExecutionRow[]
}): {
  ok: boolean
  error: string | null
  frozenPrefixOk: boolean
  frozenPrefixError: string | null
} {
  const executionMap = new Map(
    input.executions.map((row) => [row.boutId, toExecutionRecord(row)]),
  )

  try {
    const displayMap = computeScheduleDisplayNumbers({
      matsEnabled: input.matsEnabled,
      mats: input.mats,
      executions: executionMap,
      skipInvariantChecks: true,
    })

    const allNumbers = [...displayMap.values()].map((meta) => ({
      formatted: meta.scheduleDisplayNumber,
      matNumber: meta.matNumber,
      position: meta.schedulePosition,
    }))
    assertScheduleUniqueness(allNumbers, input.matsEnabled)
    assertScheduleContiguity(allNumbers, input.matsEnabled)

    for (const execution of executionMap.values()) {
      assertCompletedBoutHasFrozenNumber(execution)
    }

    let frozenPrefixOk = true
    let frozenPrefixError: string | null = null
    try {
      for (const queue of buildFrozenQueues(input.mats, input.matsEnabled, executionMap)) {
        assertFrozenPrefixInvariant(queue)
      }
    } catch (error) {
      frozenPrefixOk = false
      frozenPrefixError = error instanceof Error ? error.message : String(error)
    }

    return {
      ok: true,
      error: null,
      frozenPrefixOk,
      frozenPrefixError,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      frozenPrefixOk: false,
      frozenPrefixError: null,
    }
  }
}

async function loadRebuildContext(tx: Parameters<typeof loadFullScheduleSnapshot>[0]) {
  const fullSnapshot = await loadFullScheduleSnapshot(tx, { adminPreview: true })
  const snapshot = {
    ...fullSnapshot,
    settings: {
      ...fullSnapshot.settings,
      scheduleLegacyGap: true,
    },
  }
  const scheduled = buildScheduledMats({
    grouped: fullSnapshot.grouped,
    snapshot,
    now: new Date(),
  })
  const executions = await tx.boutScheduleExecution.findMany({
    select: {
      boutId: true,
      actualStartAt: true,
      actualEndAt: true,
      frozenScheduleFormatted: true,
      frozenScheduleMatNumber: true,
      frozenSchedulePosition: true,
    },
  })

  return {
    snapshot,
    mats: scheduled.mats.map((mat) => ({
      matIndex: mat.matIndex,
      bouts: mat.bouts,
    })),
    executions,
  }
}

export async function rebuildLegacyFrozenScheduleNumbers(input?: {
  dryRun?: boolean
  client?: PrismaClient
}): Promise<RebuildLegacyFrozenScheduleNumbersResult> {
  const dryRun = input?.dryRun === true
  const client = input?.client ?? prisma

  const settingsBefore = await client.boutsPageSetting.findUniqueOrThrow({
    where: { id: 'default' },
  })

  if (dryRun) {
    const context = await client.$transaction((tx) => loadRebuildContext(tx))
    const plan = planRebuild({
      mats: context.mats,
      matsEnabled: context.snapshot.settings.matsEnabled,
      executions: context.executions,
    })

    const simulatedExecutions = context.executions.map((row) => {
      const update = plan.updates.get(row.boutId)
      if (!update) {
        return row
      }
      return {
        ...row,
        frozenScheduleFormatted: update.formatted,
        frozenScheduleMatNumber: update.matNumber,
        frozenSchedulePosition: update.position,
      }
    })

    const validation = validateScheduleInvariants({
      mats: context.mats,
      matsEnabled: context.snapshot.settings.matsEnabled,
      executions: simulatedExecutions,
    })

    return {
      dryRun: true,
      scheduleLegacyGapBefore: settingsBefore.scheduleLegacyGap,
      scheduleLegacyGapAfter:
        validation.ok && validation.frozenPrefixOk ? false : settingsBefore.scheduleLegacyGap,
      repairedCount: plan.repairedBoutIds.length,
      backfilledMissingCount: plan.backfilledMissingBoutIds.length,
      repairedBoutIds: plan.repairedBoutIds,
      backfilledMissingBoutIds: plan.backfilledMissingBoutIds,
      invariantOk: validation.ok,
      invariantError: validation.ok ? null : validation.error,
      frozenPrefixOk: validation.frozenPrefixOk,
      frozenPrefixError: validation.frozenPrefixError,
    }
  }

  let repairedBoutIds: string[] = []
  let backfilledMissingBoutIds: string[] = []
  let invariantOk = false
  let invariantError: string | null = null
  let frozenPrefixOk = false
  let frozenPrefixError: string | null = null

  await client.$transaction(async (tx) => {
    await lockBoutsPageSetting(tx)
    const context = await loadRebuildContext(tx)
    const plan = planRebuild({
      mats: context.mats,
      matsEnabled: context.snapshot.settings.matsEnabled,
      executions: context.executions,
    })

    repairedBoutIds = plan.repairedBoutIds
    backfilledMissingBoutIds = plan.backfilledMissingBoutIds

    for (const [boutId, number] of plan.updates) {
      await tx.boutScheduleExecution.upsert({
        where: { boutId },
        create: {
          boutId,
          frozenScheduleFormatted: number.formatted,
          frozenScheduleMatNumber: number.matNumber,
          frozenSchedulePosition: number.position,
        },
        update: {
          frozenScheduleFormatted: number.formatted,
          frozenScheduleMatNumber: number.matNumber,
          frozenSchedulePosition: number.position,
        },
      })
    }

    const refreshedExecutions = context.executions.map((row) => {
      const update = plan.updates.get(row.boutId)
      if (!update) {
        return row
      }
      return {
        ...row,
        frozenScheduleFormatted: update.formatted,
        frozenScheduleMatNumber: update.matNumber,
        frozenSchedulePosition: update.position,
      }
    })

    const validation = validateScheduleInvariants({
      mats: context.mats,
      matsEnabled: context.snapshot.settings.matsEnabled,
      executions: refreshedExecutions,
    })

    invariantOk = validation.ok
    invariantError = validation.ok ? null : validation.error
    frozenPrefixOk = validation.frozenPrefixOk
    frozenPrefixError = validation.frozenPrefixError

    if (validation.ok && validation.frozenPrefixOk) {
      await tx.boutsPageSetting.update({
        where: { id: 'default' },
        data: { scheduleLegacyGap: false },
      })
    } else if (!validation.frozenPrefixOk && context.snapshot.settings.scheduleLegacyGap === false) {
      await tx.boutsPageSetting.update({
        where: { id: 'default' },
        data: { scheduleLegacyGap: true },
      })
    }
  })

  const settingsAfter = await client.boutsPageSetting.findUniqueOrThrow({
    where: { id: 'default' },
  })

  return {
    dryRun: false,
    scheduleLegacyGapBefore: settingsBefore.scheduleLegacyGap,
    scheduleLegacyGapAfter: settingsAfter.scheduleLegacyGap,
    repairedCount: repairedBoutIds.length,
    backfilledMissingCount: backfilledMissingBoutIds.length,
    repairedBoutIds,
    backfilledMissingBoutIds,
    invariantOk,
    invariantError,
    frozenPrefixOk,
    frozenPrefixError,
  }
}
