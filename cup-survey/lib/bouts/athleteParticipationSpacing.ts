import type { InternalBout } from './types'
import {
  ATHLETE_SPACING_BOUT_COUNT_MEDAL_MIN,
  ATHLETE_SPACING_BOUT_COUNT_REGULAR_MIN,
  ATHLETE_SPACING_BOUT_COUNT_MAX,
  ATHLETE_SPACING_TIME_MAX_MINUTES,
} from './settingsLimits'

export type AthleteParticipationSpacingMode = 'BOUT_COUNT' | 'TIME'

export type AthleteParticipationSpacing = {
  enabled: boolean
  mode: AthleteParticipationSpacingMode
  regular: number
  medal: number
}

export const DEFAULT_ENABLED_ATHLETE_PARTICIPATION_SPACING: AthleteParticipationSpacing = {
  enabled: true,
  mode: 'BOUT_COUNT',
  regular: 2,
  medal: 5,
}

export const DEFAULT_TIME_ATHLETE_PARTICIPATION_SPACING = {
  regular: 10,
  medal: 20,
}

export const DISABLED_ATHLETE_PARTICIPATION_SPACING: AthleteParticipationSpacing = {
  enabled: false,
  mode: 'BOUT_COUNT',
  regular: 2,
  medal: 5,
}

export type AthleteSpacingTier = 'regular' | 'medal'

export function isAthleteParticipationSpacingEnabled(
  settings: AthleteParticipationSpacing,
): boolean {
  return settings.enabled === true
}

export function resolveSpacingTier(bout: InternalBout): AthleteSpacingTier {
  return bout.schedulePhase === 'bronze' || bout.schedulePhase === 'final' ? 'medal' : 'regular'
}

export function spacingForBout(
  bout: InternalBout,
  settings: AthleteParticipationSpacing,
): number {
  const tier = resolveSpacingTier(bout)
  return tier === 'medal' ? settings.medal : settings.regular
}

export function requiredSpacingBetween(
  previousBout: InternalBout,
  nextBout: InternalBout,
  settings: AthleteParticipationSpacing,
): number {
  return Math.max(spacingForBout(previousBout, settings), spacingForBout(nextBout, settings))
}

function clampBoutCount(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return 0
  return Math.min(ATHLETE_SPACING_BOUT_COUNT_MAX, Math.max(0, value))
}

function clampTimeMinutes(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return 0
  return Math.min(ATHLETE_SPACING_TIME_MAX_MINUTES, Math.max(0, value))
}

export function normalizeAthleteParticipationSpacing(
  raw: unknown,
): AthleteParticipationSpacing {
  if (raw == null) {
    return { ...DISABLED_ATHLETE_PARTICIPATION_SPACING }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DISABLED_ATHLETE_PARTICIPATION_SPACING }
  }

  const entry = raw as Record<string, unknown>
  const enabled = entry.enabled === true
  const mode: AthleteParticipationSpacingMode = entry.mode === 'TIME' ? 'TIME' : 'BOUT_COUNT'

  if (!enabled) {
    return {
      enabled: false,
      mode,
      regular:
        typeof entry.regular === 'number'
          ? mode === 'TIME'
            ? clampTimeMinutes(entry.regular)
            : clampBoutCount(entry.regular)
          : DEFAULT_ENABLED_ATHLETE_PARTICIPATION_SPACING.regular,
      medal:
        typeof entry.medal === 'number'
          ? mode === 'TIME'
            ? clampTimeMinutes(entry.medal)
            : clampBoutCount(entry.medal)
          : DEFAULT_ENABLED_ATHLETE_PARTICIPATION_SPACING.medal,
    }
  }

  const regularRaw = typeof entry.regular === 'number' ? entry.regular : NaN
  const medalRaw = typeof entry.medal === 'number' ? entry.medal : NaN

  if (mode === 'TIME') {
    const regular = clampTimeMinutes(regularRaw)
    const medal = clampTimeMinutes(medalRaw)
    return {
      enabled: true,
      mode,
      regular: regular > 0 ? regular : DEFAULT_TIME_ATHLETE_PARTICIPATION_SPACING.regular,
      medal:
        medal >= regular && medal > 0
          ? medal
          : Math.max(regular, DEFAULT_TIME_ATHLETE_PARTICIPATION_SPACING.medal),
    }
  }

  const regular = clampBoutCount(regularRaw)
  const medal = clampBoutCount(medalRaw)
  return {
    enabled: true,
    mode,
    regular:
      regular >= ATHLETE_SPACING_BOUT_COUNT_REGULAR_MIN
        ? regular
        : DEFAULT_ENABLED_ATHLETE_PARTICIPATION_SPACING.regular,
    medal:
      medal >= ATHLETE_SPACING_BOUT_COUNT_MEDAL_MIN
        ? medal
        : DEFAULT_ENABLED_ATHLETE_PARTICIPATION_SPACING.medal,
  }
}

export function validateAthleteParticipationSpacingPatch(
  spacing: AthleteParticipationSpacing,
): string | null {
  if (!spacing.enabled) return null

  if (spacing.mode === 'BOUT_COUNT') {
    if (spacing.regular < ATHLETE_SPACING_BOUT_COUNT_REGULAR_MIN) {
      return `Обычные поединки: минимум ${ATHLETE_SPACING_BOUT_COUNT_REGULAR_MIN} слота`
    }
    if (spacing.medal < ATHLETE_SPACING_BOUT_COUNT_MEDAL_MIN) {
      return `Медальные поединки: минимум ${ATHLETE_SPACING_BOUT_COUNT_MEDAL_MIN} слотов`
    }
    return null
  }

  if (spacing.regular <= 0) {
    return 'Обычные поединки: укажите время больше 0 минут'
  }
  if (spacing.medal < spacing.regular) {
    return 'Медальные поединки: не меньше обычных'
  }
  return null
}
