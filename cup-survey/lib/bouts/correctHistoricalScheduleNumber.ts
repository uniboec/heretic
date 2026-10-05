import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import {
  assertScheduleContiguity,
  assertScheduleUniqueness,
  formatScheduleDisplayNumber,
  frozenNumberFromExecution,
} from './scheduleDisplayNumber'
import {
  InvalidScheduleInvariantError,
  ScheduleContiguityConflictError,
  ScheduleNumberConflictError,
} from './errors'
import { buildScheduledMats, loadFullScheduleSnapshot } from './scheduleService'
import { withScheduleVersionLock } from './scheduleVersion'
import { lockBoutsPageSetting } from './locks'

export type CorrectHistoricalScheduleNumberInput = {
  boutId: string
  newMatNumber: number | null
  newPosition: number
  reason: string
  expectedScheduleVersion: number
}

export async function correctHistoricalScheduleNumber(
  input: CorrectHistoricalScheduleNumberInput,
) {
  if (!input.reason.trim()) {
    throw new InvalidScheduleInvariantError('reason is required')
  }

  return prisma.$transaction(async (tx) => {
    await lockBoutsPageSetting(tx)
    const snapshot = await loadFullScheduleSnapshot(tx, { adminPreview: true })
    const scheduled = buildScheduledMats({
      grouped: snapshot.grouped,
      snapshot,
      now: new Date(),
    })

    const execution = await tx.boutScheduleExecution.findUnique({
      where: { boutId: input.boutId },
    })
    if (!execution?.frozenScheduleFormatted) {
      throw new InvalidScheduleInvariantError('Only frozen bouts can be corrected')
    }

    const bout = scheduled.mats.flatMap((mat) => mat.bouts).find((entry) => entry.id === input.boutId)
    if (!bout) {
      throw new InvalidScheduleInvariantError('Bout not found in schedule')
    }

    if (snapshot.settings.matsEnabled) {
      if (input.newMatNumber == null || input.newMatNumber !== bout.matIndex) {
        throw new InvalidScheduleInvariantError(
          'newMatNumber must match runtime mat assignment in v1',
        )
      }
    } else if (input.newMatNumber != null) {
      throw new InvalidScheduleInvariantError('newMatNumber must be null when matsEnabled=false')
    }

    const formatted = formatScheduleDisplayNumber(
      input.newMatNumber,
      input.newPosition,
      snapshot.settings.matsEnabled,
    )

    const frozenNumbers = scheduled.mats
      .flatMap((mat) => mat.bouts)
      .map((entry) => {
        const row = entry.id === input.boutId
          ? {
              formatted,
              matNumber: input.newMatNumber,
              position: input.newPosition,
            }
          : frozenNumberFromExecution({
              boutId: entry.id,
              actualStartAt: null,
              actualEndAt: null,
              frozenScheduleFormatted: entry.isFrozen ? entry.scheduleDisplayNumber : null,
              frozenScheduleMatNumber: entry.matNumber,
              frozenSchedulePosition: entry.schedulePosition,
            })
        if (!row) {
          return null
        }
        return row
      })
      .filter((row): row is NonNullable<typeof row> => row != null)

    const occupiedByOther = scheduled.mats
      .flatMap((mat) => mat.bouts)
      .some(
        (entry) =>
          entry.id !== input.boutId &&
          entry.isFrozen &&
          entry.scheduleDisplayNumber === formatted,
      )
    if (occupiedByOther) {
      throw new ScheduleNumberConflictError()
    }

    try {
      assertScheduleUniqueness(frozenNumbers, snapshot.settings.matsEnabled)
      assertScheduleContiguity(frozenNumbers, snapshot.settings.matsEnabled)
    } catch (error) {
      if (error instanceof ScheduleNumberConflictError) {
        throw error
      }
      throw new ScheduleContiguityConflictError()
    }

    const locked = await withScheduleVersionLock(tx, input.expectedScheduleVersion, async () => {
      await tx.boutScheduleExecution.update({
        where: { boutId: input.boutId },
        data: {
          frozenScheduleFormatted: formatted,
          frozenScheduleMatNumber: input.newMatNumber,
          frozenSchedulePosition: input.newPosition,
        },
      })
      return {
        result: {
          boutId: input.boutId,
          scheduleDisplayNumber: formatted,
          schedulePosition: input.newPosition,
          matNumber: input.newMatNumber,
        },
        changed: true,
      }
    })

    return {
      success: true,
      committedScheduleVersion: locked.committedScheduleVersion,
      scheduleVersion: locked.scheduleVersion,
      ...locked.result,
    }
  })
}
