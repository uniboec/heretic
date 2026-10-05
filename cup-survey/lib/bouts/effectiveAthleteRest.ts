import type { AthleteParticipationSpacing } from './athleteParticipationSpacing'
import { requiredSpacingBetween } from './athleteParticipationSpacing'
import type { InternalBout } from './types'

export function maxRestUntil(dates: Array<Date | null | undefined>): Date | null {
  let max: Date | null = null
  for (const date of dates) {
    if (!date) continue
    if (!max || date.getTime() > max.getTime()) max = date
  }
  return max
}

export function computeAthleteParticipationSpacingRestUntil(input: {
  previousBout: InternalBout | null
  nextBout: InternalBout
  previousEndedAt: Date | null
  settings: AthleteParticipationSpacing
}): Date | null {
  if (!input.settings.enabled || input.settings.mode !== 'TIME') return null
  if (!input.previousBout || !input.previousEndedAt) return null

  const requiredMinutes = requiredSpacingBetween(
    input.previousBout,
    input.nextBout,
    input.settings,
  )
  if (requiredMinutes <= 0) return null

  return new Date(input.previousEndedAt.getTime() + requiredMinutes * 60_000)
}

export function computeEffectiveRestUntil(input: {
  existingRestUntil: Date | null
  spacingRestUntil: Date | null
}): Date | null {
  return maxRestUntil([input.existingRestUntil, input.spacingRestUntil])
}

export function isBeforeEffectiveRest(now: Date, effectiveRestUntil: Date | null): boolean {
  if (!effectiveRestUntil) return false
  return now.getTime() < effectiveRestUntil.getTime()
}
