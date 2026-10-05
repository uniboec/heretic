import type { Prisma } from '@prisma/client'
import { ScheduleVersionConflictError } from './errors'
import { lockBoutsPageSetting } from './locks'

export type ScheduleMutationOutcome<T> = {
  result: T
  changed: boolean
}

export type ScheduleVersionLockResult<T> = {
  result: T
  scheduleVersion: number
  committedScheduleVersion: number
}

export async function readScheduleVersion(tx: Prisma.TransactionClient): Promise<number> {
  const settings = await tx.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
  return settings.scheduleVersion
}

export async function withScheduleVersionLock<T>(
  tx: Prisma.TransactionClient,
  expectedVersion: number,
  fn: () => Promise<ScheduleMutationOutcome<T>>,
): Promise<ScheduleVersionLockResult<T>> {
  const settings = await lockBoutsPageSetting(tx)
  if (settings.scheduleVersion !== expectedVersion) {
    throw new ScheduleVersionConflictError()
  }

  const { result, changed } = await fn()
  let scheduleVersion = settings.scheduleVersion
  if (changed) {
    const updated = await tx.boutsPageSetting.update({
      where: { id: 'default' },
      data: { scheduleVersion: { increment: 1 } },
    })
    scheduleVersion = updated.scheduleVersion
  }

  return {
    result,
    scheduleVersion,
    committedScheduleVersion: scheduleVersion,
  }
}
