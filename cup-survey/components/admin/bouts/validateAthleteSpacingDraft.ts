import type { AthleteParticipationSpacing } from '@/lib/bouts/athleteParticipationSpacing'
import { validateAthleteParticipationSpacingPatch } from '@/lib/bouts/athleteParticipationSpacing'
import {
  ATHLETE_SPACING_BOUT_COUNT_MAX,
  ATHLETE_SPACING_TIME_MAX_MINUTES,
} from '@/lib/bouts/settingsLimits'

export type AthleteSpacingDraft = AthleteParticipationSpacing

export function validateAthleteSpacingDraft(draft: AthleteSpacingDraft): {
  regular?: string
  medal?: string
  enabled?: string
} {
  const errors: { regular?: string; medal?: string; enabled?: string } = {}

  if (!draft.enabled) return errors

  const patchError = validateAthleteParticipationSpacingPatch(draft)
  if (patchError) {
    if (draft.mode === 'BOUT_COUNT') {
      if (draft.regular < 2) errors.regular = 'Минимум 2 слота'
      if (draft.medal < 5) errors.medal = 'Минимум 5 слотов'
    } else {
      if (draft.regular <= 0) errors.regular = 'Укажите время больше 0'
      if (draft.medal < draft.regular) errors.medal = 'Не меньше обычных'
    }
    if (!errors.regular && !errors.medal) {
      errors.regular = patchError
    }
  }

  const max = draft.mode === 'TIME' ? ATHLETE_SPACING_TIME_MAX_MINUTES : ATHLETE_SPACING_BOUT_COUNT_MAX
  if (draft.regular > max) errors.regular = `Максимум ${max}`
  if (draft.medal > max) errors.medal = `Максимум ${max}`

  return errors
}
