import { buildScheduledMats, loadFullScheduleSnapshot } from './scheduleService'
import type { Prisma } from '@prisma/client'

export async function buildScheduleDisplayByBoutId(
  tx: Prisma.TransactionClient,
  options: { adminPreview?: boolean } = {},
): Promise<Map<string, string>> {
  const snapshot = await loadFullScheduleSnapshot(tx, {
    adminPreview: options.adminPreview ?? true,
  })
  const scheduled = buildScheduledMats({
    grouped: snapshot.grouped,
    snapshot,
    now: new Date(),
  })
  const map = new Map<string, string>()
  for (const mat of scheduled.mats) {
    for (const bout of mat.bouts) {
      map.set(bout.id, bout.scheduleDisplayNumber)
    }
  }
  return map
}

export function buildScheduleDisplayMetaByBoutId(
  scheduledMats: ReturnType<typeof buildScheduledMats>['mats'],
): Map<
  string,
  {
    scheduleDisplayNumber: string
    isInEditableZone: boolean
    isNextStartable: boolean
    matNumber: number | null
  }
> {
  const map = new Map<
    string,
    {
      scheduleDisplayNumber: string
      isInEditableZone: boolean
      isNextStartable: boolean
      matNumber: number | null
    }
  >()
  for (const mat of scheduledMats) {
    for (const bout of mat.bouts) {
      map.set(bout.id, {
        scheduleDisplayNumber: bout.scheduleDisplayNumber,
        isInEditableZone: bout.isInEditableZone,
        isNextStartable: bout.isNextStartable,
        matNumber: bout.matNumber,
      })
    }
  }
  return map
}
