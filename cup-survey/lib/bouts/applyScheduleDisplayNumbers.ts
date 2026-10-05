import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import { computeScheduleDisplayNumbers } from './scheduleDisplayNumber'
import { applyScheduleHintLabels } from './resolveScheduleHintLabels'
import type { PublicMatTiming, ScheduleExecutionRecord, ScheduledBout } from './scheduleTypes'

export function applyScheduleDisplayNumbers(input: {
  mats: PublicMatTiming[]
  settings: NormalizedBoutsPageSettings
  executions: Map<string, ScheduleExecutionRecord>
}): PublicMatTiming[] {
  const displayByBoutId = computeScheduleDisplayNumbers({
    matsEnabled: input.settings.matsEnabled,
    mats: input.mats.map((mat) => ({
      matIndex: mat.matIndex,
      bouts: mat.bouts,
    })),
    executions: input.executions,
    skipInvariantChecks: input.settings.scheduleLegacyGap,
  })

  const matsWithDisplayNumbers = input.mats.map((mat) => ({
    ...mat,
    bouts: mat.bouts.map((bout) => {
      const display = displayByBoutId.get(bout.id)
      if (!display) {
        return bout
      }
      return {
        ...bout,
        scheduleDisplayNumber: display.scheduleDisplayNumber,
        schedulePosition: display.schedulePosition,
        matId: display.matId,
        matNumber: display.matNumber,
        isFrozen: display.isFrozen,
        isInEditableZone: display.isInEditableZone,
        isNextStartable: display.isNextStartable,
      } satisfies ScheduledBout
    }),
  }))

  return applyScheduleHintLabels(matsWithDisplayNumbers)
}
