import { TOURNAMENT_TIMEZONE } from '../config/tournament'
import { toTournamentInstant } from '../datetime/tournament'
import { MAX_COMPETITION_STAGE } from './competitionStages'

export const MAX_BREAK_AFTER_STAGE_MINUTES = 24 * 60

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/

export type CompetitionStageSettings = {
  breaksAfterStageMinutes: Record<string, number>
  notBeforeStartTimes: Record<string, string>
}

export const EMPTY_COMPETITION_STAGE_SETTINGS: CompetitionStageSettings = {
  breaksAfterStageMinutes: {},
  notBeforeStartTimes: {},
}

function normalizeStageKey(raw: string): number | null {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > MAX_COMPETITION_STAGE) return null
  return n
}

function normalizeBreakMinutes(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  if (!Number.isInteger(v)) return null
  if (v < 0 || v > MAX_BREAK_AFTER_STAGE_MINUTES) return null
  return v
}

export function isValidNotBeforeLocalTime(value: string): boolean {
  return HH_MM.test(value.trim())
}

function normalizeNotBeforeTime(v: unknown): string | null {
  if (typeof v !== 'string' || !isValidNotBeforeLocalTime(v)) return null
  return v.trim()
}

export function normalizeCompetitionStageSettings(raw: unknown): CompetitionStageSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const breaksAfterStageMinutes: Record<string, number> = {}
  const notBeforeStartTimes: Record<string, string> = {}
  const rawBreaks = src.breaksAfterStageMinutes
  const rawNotBefore = src.notBeforeStartTimes
  if (rawBreaks && typeof rawBreaks === 'object') {
    for (const [k, v] of Object.entries(rawBreaks)) {
      const stage = normalizeStageKey(k)
      const minutes = normalizeBreakMinutes(v)
      if (stage != null && minutes != null) breaksAfterStageMinutes[String(stage)] = minutes
    }
  }
  if (rawNotBefore && typeof rawNotBefore === 'object') {
    for (const [k, v] of Object.entries(rawNotBefore)) {
      const stage = normalizeStageKey(k)
      const time = normalizeNotBeforeTime(v)
      if (stage != null && stage >= 2 && time != null) notBeforeStartTimes[String(stage)] = time
    }
  }
  return { breaksAfterStageMinutes, notBeforeStartTimes }
}

export function resolveStageNotBefore(
  stage: number,
  settings: CompetitionStageSettings,
  eventDate: string,
  timeZone: string,
): Date {
  if (stage === 1) return new Date(0)
  const localTime = settings.notBeforeStartTimes[String(stage)]
  if (!localTime) return new Date(0)
  return toTournamentInstant({ eventDate, localTime, timeZone: timeZone || TOURNAMENT_TIMEZONE })
}

export type StageSettingsDiff = {
  notBeforeChanges: Array<{ stage: number; oldValue?: string; newValue?: string }>
  breakAfterChanges: Array<{ stage: number; oldValue?: number; newValue?: number }>
}

export function diffStageSettings(
  oldSettings: CompetitionStageSettings,
  newSettings: CompetitionStageSettings,
): StageSettingsDiff {
  const notBeforeChanges: StageSettingsDiff['notBeforeChanges'] = []
  const breakAfterChanges: StageSettingsDiff['breakAfterChanges'] = []

  const allNotBeforeKeys = new Set([
    ...Object.keys(oldSettings.notBeforeStartTimes),
    ...Object.keys(newSettings.notBeforeStartTimes),
  ])
  for (const key of allNotBeforeKeys) {
    const stage = Number(key)
    const oldValue = oldSettings.notBeforeStartTimes[key]
    const newValue = newSettings.notBeforeStartTimes[key]
    if (oldValue !== newValue) {
      notBeforeChanges.push({ stage, oldValue, newValue })
    }
  }

  const allBreakKeys = new Set([
    ...Object.keys(oldSettings.breaksAfterStageMinutes),
    ...Object.keys(newSettings.breaksAfterStageMinutes),
  ])
  for (const key of allBreakKeys) {
    const stage = Number(key)
    const oldValue = oldSettings.breaksAfterStageMinutes[key]
    const newValue = newSettings.breaksAfterStageMinutes[key]
    if (oldValue !== newValue) {
      breakAfterChanges.push({ stage, oldValue, newValue })
    }
  }

  return { notBeforeChanges, breakAfterChanges }
}
