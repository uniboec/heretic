import type { MatStartTimeOverrides } from './startTimes.types'
import {
  DEFAULT_BOUTS_START_TIME,
  normalizeBoutsStartTime,
  sanitizeMatStartTimeOverrides,
} from './startTimes'
import { sanitizeAgeDivisionDurationOverrides } from './boutDuration'
import type { AutoMatAssignMode } from './autoMatMode'
import {
  EMPTY_COMPETITION_STAGE_SETTINGS,
  normalizeCompetitionStageSettings,
  type CompetitionStageSettings,
} from './competitionStageSettings'
import {
  normalizeAthleteParticipationSpacing,
  type AthleteParticipationSpacing,
} from './athleteParticipationSpacing'
import {
  EMPTY_BOUT_SCHEDULE_WAVES,
  sanitizeBoutScheduleWaves,
  type BoutScheduleWaves,
} from './boutScheduleWaves'

export type NormalizedBoutsPageSettings = {
  publicEnabled: boolean
  matCount: number
  matsEnabled: boolean
  scheduleVersion: number
  scheduleLegacyGap: boolean
  eventFinalized: boolean
  autoMatAssignMode: AutoMatAssignMode
  autoMatByCategoryEnabled: boolean
  boutsStartTime: string
  matStartTimeOverrides: MatStartTimeOverrides
  boutBreakMinutes: number
  ageDivisionDurationOverrides: Record<string, number>
  pinAllFinalsToEnd: boolean
  competitionStageSettings: CompetitionStageSettings
  athleteParticipationSpacing: AthleteParticipationSpacing
  boutScheduleWaves: BoutScheduleWaves
}

export function normalizeBoutsPageSettings(
  raw: {
    publicEnabled: boolean
    matCount: number
    matsEnabled?: boolean | null
    scheduleVersion?: number | null
    scheduleLegacyGap?: boolean | null
    eventFinalized?: boolean | null
    autoMatAssignMode: AutoMatAssignMode
    autoMatByCategoryEnabled: boolean
    boutsStartTime?: string | null
    matStartTimeOverrides?: unknown
    boutBreakMinutes?: number | null
    ageDivisionDurationOverrides?: unknown
    pinAllFinalsToEnd?: boolean | null
    competitionStageSettings?: unknown
    athleteParticipationSpacing?: unknown
    boutScheduleWaves?: unknown
  },
): NormalizedBoutsPageSettings {
  const breakMinutes =
    typeof raw.boutBreakMinutes === 'number' &&
    Number.isInteger(raw.boutBreakMinutes) &&
    raw.boutBreakMinutes >= 0 &&
    raw.boutBreakMinutes <= 30
      ? raw.boutBreakMinutes
      : 3

  const scheduleVersion =
    typeof raw.scheduleVersion === 'number' &&
    Number.isInteger(raw.scheduleVersion) &&
    raw.scheduleVersion >= 0
      ? raw.scheduleVersion
      : 0

  return {
    publicEnabled: raw.publicEnabled,
    matCount: raw.matCount,
    matsEnabled: raw.matsEnabled !== false,
    scheduleVersion,
    scheduleLegacyGap: raw.scheduleLegacyGap === true,
    eventFinalized: raw.eventFinalized === true,
    autoMatAssignMode: raw.autoMatAssignMode,
    autoMatByCategoryEnabled: raw.autoMatByCategoryEnabled,
    boutsStartTime: normalizeBoutsStartTime(raw.boutsStartTime ?? DEFAULT_BOUTS_START_TIME),
    matStartTimeOverrides: sanitizeMatStartTimeOverrides(
      raw.matStartTimeOverrides,
      raw.matCount,
    ),
    boutBreakMinutes: breakMinutes,
    ageDivisionDurationOverrides: sanitizeAgeDivisionDurationOverrides(
      raw.ageDivisionDurationOverrides,
    ),
    pinAllFinalsToEnd: raw.pinAllFinalsToEnd === true,
    competitionStageSettings: raw.competitionStageSettings != null
      ? normalizeCompetitionStageSettings(raw.competitionStageSettings)
      : EMPTY_COMPETITION_STAGE_SETTINGS,
    athleteParticipationSpacing: normalizeAthleteParticipationSpacing(
      raw.athleteParticipationSpacing,
    ),
    boutScheduleWaves: raw.boutScheduleWaves != null
      ? sanitizeBoutScheduleWaves(raw.boutScheduleWaves)
      : EMPTY_BOUT_SCHEDULE_WAVES,
  }
}
