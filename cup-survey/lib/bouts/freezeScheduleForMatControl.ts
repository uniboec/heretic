import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { buildMatScheduleEntries } from './matControlContext'
import { executeScheduleMutation } from './executeScheduleMutation'
import { freezeScheduleNumberIfNeeded } from './freezeScheduleNumber'
import { orderMatBoutsForRuntime } from './matRuntimeOrder'
import { reorderScheduledBoutsByRuntimeOrder } from './runtimeNextStartable'
import { resolveMatIndexFromBout } from './resolveMatIndexFromBout'
import { loadFullScheduleSnapshot, buildScheduledMats } from './scheduleService'
import { isScheduleFreezeIntent } from './scheduleFreezeIntent'
import type { ControlIntent } from './mat-control/types'
import { BoutsValidationError } from './errors'

export async function freezeScheduleForMatControlCommand(input: {
  boutId: string
  intent: ControlIntent
  operationId: string
  expectedScheduleVersion?: number
  payload: Record<string, unknown>
  actorId: string | null
}) {
  if (!isScheduleFreezeIntent(input.intent)) {
    return null
  }

  const execution = await prisma.boutScheduleExecution.findUnique({
    where: { boutId: input.boutId },
    select: { frozenScheduleFormatted: true, actualStartAt: true },
  })
  if (execution?.frozenScheduleFormatted) {
    return null
  }
  if (input.intent === 'CONFIRM' && execution?.actualStartAt) {
    return null
  }
  if (input.expectedScheduleVersion === undefined) {
    throw new BoutsValidationError('Для команды требуется expectedScheduleVersion')
  }

  return executeScheduleMutation({
    mutationId: input.operationId,
    boutId: input.boutId,
    command: input.intent,
    payload: input.payload,
    actorId: input.actorId,
    expectedScheduleVersion: input.expectedScheduleVersion,
    execute: async (tx: Prisma.TransactionClient) => {
      const snapshot = await loadFullScheduleSnapshot(tx, { adminPreview: true })
      const scheduled = buildScheduledMats({
        grouped: snapshot.grouped,
        snapshot,
        now: new Date(),
      })
      const executions = new Map(
        snapshot.executions.map((row) => [row.boutId, row]),
      )
      const matIndex = resolveMatIndexFromBout(
        input.boutId,
        buildMatScheduleEntries(snapshot.grouped),
      )
      const runtimeOrder = orderMatBoutsForRuntime({
        groupedMats: snapshot.grouped.mats,
        matIndex,
        overrides: snapshot.scheduleOverrides,
        settings: snapshot.settings,
      })
      const matsForFreeze = scheduled.mats.map((mat) =>
        mat.matIndex === matIndex
          ? {
              ...mat,
              bouts: reorderScheduledBoutsByRuntimeOrder(mat.bouts, runtimeOrder),
            }
          : mat,
      )
      const freeze = await freezeScheduleNumberIfNeeded(
        tx,
        input.boutId,
        {
          matsEnabled: snapshot.settings.matsEnabled,
          mats: matsForFreeze,
          executions,
          skipInvariantChecks: snapshot.settings.scheduleLegacyGap,
        },
        { flexibleOrder: true },
      )
      return {
        result: {
          scheduleDisplayNumber: freeze.formatted,
        },
        changed: freeze.changed,
      }
    },
  })
}
