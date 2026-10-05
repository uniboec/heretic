import { buildScheduledMatsResultOrThrow, readFullScheduleSnapshot } from './scheduleService'

export async function loadScheduleDisplayByBoutId(input?: {
  adminPreview?: boolean
}): Promise<Map<string, string>> {
  try {
    const snapshot = await readFullScheduleSnapshot({
      adminPreview: input?.adminPreview ?? true,
    })
    if (!snapshot.published) {
      return new Map()
    }

    const scheduled = buildScheduledMatsResultOrThrow({
      grouped: snapshot.grouped,
      snapshot,
      now: new Date(),
    })

    const map = new Map<string, string>()
    for (const mat of scheduled.mats) {
      for (const bout of mat.bouts) {
        if (bout.scheduleDisplayNumber) {
          map.set(bout.id, bout.scheduleDisplayNumber)
        }
      }
    }
    return map
  } catch {
    return new Map()
  }
}
