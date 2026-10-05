import type { Prisma } from '@prisma/client'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import { lockBoutsPageSetting } from './locks'
import { ScheduleVersionConflictError } from './errors'
import { assertStructuralScheduleMutationAllowed } from './scheduleZoneValidation'
import { syncScheduleLegacyGapIfNeeded } from './syncScheduleLegacyGap'
import { withScheduleVersionLock } from './scheduleVersion'

export type StructuralScheduleMutationResult<T> = {
  result: T
  scheduleVersion: number
  committedScheduleVersion: number
}

export async function runStructuralScheduleMutation<T>(input: {
  tx: Prisma.TransactionClient
  settings: NormalizedBoutsPageSettings
  expectedScheduleVersion?: number
  execute: () => Promise<T>
  changed?: boolean
}): Promise<StructuralScheduleMutationResult<T>> {
  assertStructuralScheduleMutationAllowed(input.settings)
  await lockBoutsPageSetting(input.tx)

  const expectedVersion = input.expectedScheduleVersion ?? input.settings.scheduleVersion
  const locked = await withScheduleVersionLock(input.tx, expectedVersion, async () => ({
    result: await input.execute(),
    changed: input.changed ?? true,
  }))

  if (locked.changed) {
    await syncScheduleLegacyGapIfNeeded(input.tx)
  }

  return {
    result: locked.result,
    scheduleVersion: locked.scheduleVersion,
    committedScheduleVersion: locked.committedScheduleVersion,
  }
}

export async function bumpScheduleVersionIfNeeded(
  tx: Prisma.TransactionClient,
  expectedVersion: number,
  changed: boolean,
): Promise<number> {
  if (!changed) {
    const settings = await tx.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    if (settings.scheduleVersion !== expectedVersion) {
      throw new ScheduleVersionConflictError()
    }
    return settings.scheduleVersion
  }
  const locked = await withScheduleVersionLock(tx, expectedVersion, async () => ({
    result: null,
    changed: true,
  }))
  return locked.scheduleVersion
}
