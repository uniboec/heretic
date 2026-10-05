import { BoutNotFoundError } from './mat-control/errors'
import type { MatScheduleEntry } from './mat-control/types'

export function resolveMatIndexFromBout(
  boutId: string,
  schedule: readonly MatScheduleEntry[],
): number {
  const entry = schedule.find((item) => item.boutId === boutId)
  if (!entry) {
    throw new BoutNotFoundError(`Поединок ${boutId} не найден в расписании`)
  }
  return entry.matIndex
}

export function tryResolveMatIndexFromBout(
  boutId: string,
  schedule: readonly MatScheduleEntry[],
): number | null {
  return schedule.find((item) => item.boutId === boutId)?.matIndex ?? null
}
