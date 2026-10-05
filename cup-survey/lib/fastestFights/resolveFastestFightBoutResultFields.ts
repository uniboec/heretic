import type { EffectiveBoutStoppage } from '@/lib/bouts/resolveEffectiveBoutStoppage'
import { isFastestFightRankingEligible } from './eligibility'

export type FastestFightBoutResultFields = {
  boutElapsedMs: number | null
  stoppageEventId: string | null
  stoppageTrigger: string | null
}

export function resolveFastestFightBoutResultFields(
  victoryMethod: string,
  effectiveStoppage: EffectiveBoutStoppage | null,
  options: { fightOfficiallyStarted: boolean },
): FastestFightBoutResultFields {
  if (!effectiveStoppage) {
    return {
      boutElapsedMs: null,
      stoppageEventId: null,
      stoppageTrigger: null,
    }
  }

  const boutElapsedMs = isFastestFightRankingEligible({
    victoryMethod,
    boutElapsedMs: effectiveStoppage.boutElapsedMs,
    fightOfficiallyStarted: options.fightOfficiallyStarted,
  })
    ? effectiveStoppage.boutElapsedMs
    : null

  return {
    boutElapsedMs,
    stoppageEventId: effectiveStoppage.eventId,
    stoppageTrigger: effectiveStoppage.trigger,
  }
}
