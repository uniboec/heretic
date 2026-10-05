import type { Prisma } from '@prisma/client'
import type { InternalBout, GroupedBoutsResult } from './types'
import type {
  BoutEventRecord,
  BoutParticipantContext,
  MatScheduleEntry,
} from './mat-control/types'
import { BoutNotFoundError } from './mat-control/errors'

export function buildMatScheduleEntries(grouped: GroupedBoutsResult): MatScheduleEntry[] {
  const entries: MatScheduleEntry[] = []
  for (const mat of grouped.mats) {
    for (const bout of mat.bouts) {
      entries.push({ boutId: bout.id, matIndex: mat.matIndex })
    }
  }
  return entries
}

export function findBoutInSchedule(
  boutId: string,
  grouped: GroupedBoutsResult,
): { bout: InternalBout; matIndex: number } {
  for (const mat of grouped.mats) {
    const bout = mat.bouts.find((entry) => entry.id === boutId)
    if (bout) {
      return { bout, matIndex: mat.matIndex }
    }
  }
  throw new BoutNotFoundError(`Поединок ${boutId} не найден в расписании`)
}

export function resolveCornersSwappedFromEvents(
  events: BoutEventRecord[],
  attemptNumber: number,
): boolean {
  const swapCount = events.filter(
    (event) =>
      !event.undoneAt &&
      event.attemptNumber === attemptNumber &&
      event.eventType === 'CORNER_SWAP',
  ).length
  return swapCount % 2 === 1
}

export function buildParticipantContext(
  bout: InternalBout,
  liveSnapshot?: unknown,
): BoutParticipantContext {
  const snapshot =
    liveSnapshot && typeof liveSnapshot === 'object'
      ? (liveSnapshot as { cornersSwapped?: boolean })
      : null
  const cornersSwapped = snapshot?.cornersSwapped === true

  const redEntryId = bout.sideA.kind === 'athlete' ? bout.sideA.entryId : null
  const blueEntryId = bout.sideB.kind === 'athlete' ? bout.sideB.entryId : null

  return { redEntryId, blueEntryId, cornersSwapped }
}

export async function loadBoutEvents(
  tx: Prisma.TransactionClient,
  boutId: string,
  attemptNumber?: number,
) {
  const rows = await tx.boutEvent.findMany({
    where: {
      boutId,
      ...(attemptNumber != null ? { attemptNumber } : {}),
    },
    orderBy: { sequence: 'asc' },
  })
  return rows
}
