import type { InternalBout, InternalBoutSide } from './types'
import type { ScheduledBout } from './scheduleTypes'

export function enrichBoutsWithScheduleDisplay(
  bouts: InternalBout[],
  scheduledBouts: ScheduledBout[],
): InternalBout[] {
  const metaById = new Map(
    scheduledBouts.map((bout) => [
      bout.id,
      {
        scheduleDisplayNumber: bout.scheduleDisplayNumber,
        isNextStartable: bout.isNextStartable,
        label: bout.label,
        sideA: bout.sideA as InternalBoutSide,
        sideB: bout.sideB as InternalBoutSide,
      },
    ]),
  )
  return bouts.map((bout) => {
    const meta = metaById.get(bout.id)
    if (!meta) {
      return {
        ...bout,
        scheduleDisplayNumber: bout.scheduleDisplayNumber ?? '',
        isNextStartable: bout.isNextStartable ?? false,
      }
    }

    return {
      ...bout,
      scheduleDisplayNumber: meta.scheduleDisplayNumber,
      isNextStartable: meta.isNextStartable,
      ...(meta.label ? { label: meta.label } : {}),
      sideA: meta.sideA,
      sideB: meta.sideB,
    }
  })
}
