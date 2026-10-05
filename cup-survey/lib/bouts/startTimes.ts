import type { MatKey, MatStartTimeOverrides } from './startTimes.types'
import { MAT_KEYS } from './startTimes.types'

export const DEFAULT_BOUTS_START_TIME = '10:00'

const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isValidLocalTime(value: string): boolean {
  return HH_MM_REGEX.test(value)
}

export function parseLocalTime(value: string): { hours: number; minutes: number } | null {
  const match = HH_MM_REGEX.exec(value)
  if (!match) return null
  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  }
}

export function normalizeBoutsStartTime(value: unknown): string {
  if (typeof value === 'string' && isValidLocalTime(value)) {
    return value
  }
  return DEFAULT_BOUTS_START_TIME
}

export function sanitizeMatStartTimeOverrides(
  raw: unknown,
  matCount: number,
): MatStartTimeOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const result: MatStartTimeOverrides = {}
  for (const key of MAT_KEYS) {
    const matIndex = Number(key)
    if (matIndex > matCount) continue
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value === 'string' && isValidLocalTime(value)) {
      result[key] = value
    }
  }
  return result
}

export function resolveMatStartTime(
  matIndex: number,
  settings: {
    boutsStartTime: string
    matStartTimeOverrides: MatStartTimeOverrides
  },
): string {
  const key = String(matIndex) as MatKey
  return settings.matStartTimeOverrides[key] ?? settings.boutsStartTime
}

export function pruneMatStartTimeOverridesForMatCount(
  overrides: MatStartTimeOverrides,
  matCount: number,
): MatStartTimeOverrides {
  const result: MatStartTimeOverrides = {}
  for (const key of MAT_KEYS) {
    if (Number(key) > matCount) continue
    const value = overrides[key]
    if (value) {
      result[key] = value
    }
  }
  return result
}

export function formatBoutTime(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatBoutTimeRange(
  startIso: string,
  endIso: string,
  timeZone: string,
): string {
  return `${formatBoutTime(startIso, timeZone)}–${formatBoutTime(endIso, timeZone)}`
}
