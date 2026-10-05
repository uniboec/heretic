import { isStaleInternalBoutLabel } from '../brackets/scheduleBoutLabel'
import {
  formatScheduleAdvanceHint,
  parseInternalAdvanceHintLabel,
} from '../brackets/scheduleHint'
import type { PublicMatTiming, ScheduledBout } from './scheduleTypes'
import type { InternalBoutSide, InternalHintSide } from './types'

function resolveHintSideLabel(
  side: InternalBoutSide,
  categoryKey: string,
  scheduleDisplayByBoutId: Map<string, string>,
): InternalBoutSide {
  if (side.kind !== 'hint' || !side.label) {
    return side
  }

  const resolved = side.source
    ? formatScheduleAdvanceHint({
        categoryKey,
        feederMatchId: side.source.matchId,
        outcome: side.source.outcome,
        released: true,
        scheduleDisplayByBoutId,
        fallbackHint: side.label,
      })
    : (() => {
        const parsed = parseInternalAdvanceHintLabel(side.label)
        if (!parsed) return undefined
        return formatScheduleAdvanceHint({
          categoryKey,
          feederMatchId: parsed.feederMatchId,
          outcome: parsed.outcome,
          released: true,
          scheduleDisplayByBoutId,
          fallbackHint: side.label,
        })
      })()

  if (!resolved || resolved === side.label) {
    return side
  }

  return { ...side, label: resolved } satisfies InternalHintSide
}

function resolveScheduledBoutLabel(bout: ScheduledBout): ScheduledBout {
  if (
    !bout.label ||
    !isStaleInternalBoutLabel(bout.label) ||
    !bout.scheduleDisplayNumber
  ) {
    return bout
  }

  return {
    ...bout,
    label: `Бой ${bout.scheduleDisplayNumber}`,
  }
}

function resolveScheduledBoutHintLabels(
  bout: ScheduledBout,
  scheduleDisplayByBoutId: Map<string, string>,
): ScheduledBout {
  const withHints = {
    ...bout,
    sideA: resolveHintSideLabel(bout.sideA, bout.categoryKey, scheduleDisplayByBoutId),
    sideB: resolveHintSideLabel(bout.sideB, bout.categoryKey, scheduleDisplayByBoutId),
  }

  return resolveScheduledBoutLabel(withHints)
}

export function applyScheduleHintLabels(mats: PublicMatTiming[]): PublicMatTiming[] {
  const scheduleDisplayByBoutId = new Map<string, string>()
  for (const mat of mats) {
    for (const bout of mat.bouts) {
      if (bout.scheduleDisplayNumber) {
        scheduleDisplayByBoutId.set(bout.id, bout.scheduleDisplayNumber)
      }
    }
  }

  return mats.map((mat) => ({
    ...mat,
    bouts: mat.bouts.map((bout) =>
      resolveScheduledBoutHintLabels(bout, scheduleDisplayByBoutId),
    ),
  }))
}
