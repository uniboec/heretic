import { fseAgeDivisions } from '../config/fseCategories'
import { parseRegistrationCategoryKey } from '../registration/categoryIdentity'

export type AgeDivisionDurationOverrides = Record<string, number>

const VALID_DIVISION_IDS = new Set(fseAgeDivisions.map((division) => division.id))

export const DURATION_BANDS = [
  { label: '4–9', ageMin: 4, ageMax: 9, minutes: 2 },
  { label: '10–15', ageMin: 10, ageMax: 15, minutes: 3 },
  { label: '16–17', ageMin: 16, ageMax: 17, minutes: 4 },
  { label: '18–29', ageMin: 18, ageMax: 29, minutes: 5 },
  { label: '30–39', ageMin: 30, ageMax: 39, minutes: 4 },
  { label: '40–49', ageMin: 40, ageMax: 49, minutes: 4 },
  { label: '50–59', ageMin: 50, ageMax: 59, minutes: 3 },
  { label: '60+', ageMin: 60, ageMax: null, minutes: 3 },
] as const

export function defaultDurationMinutesForAge(ageMin: number, ageMax: number | null): number {
  for (const band of DURATION_BANDS) {
    const divisionWhollyInBand =
      ageMin >= band.ageMin && (band.ageMax === null || (ageMax ?? ageMin) <= band.ageMax)
    if (divisionWhollyInBand) {
      return band.minutes
    }
  }
  return 5
}

export function defaultDurationMinutesForDivisionId(ageDivisionId: string): number {
  const division = fseAgeDivisions.find((item) => item.id === ageDivisionId)
  if (!division) return 5
  return defaultDurationMinutesForAge(division.ageMin, division.ageMax)
}

export function sanitizeAgeDivisionDurationOverrides(raw: unknown): AgeDivisionDurationOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const result: AgeDivisionDurationOverrides = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_DIVISION_IDS.has(key)) continue
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 60) {
      continue
    }
    result[key] = value
  }
  return result
}

export function resolveBoutDurationMinutes(input: {
  categoryKey: string
  overrides: AgeDivisionDurationOverrides
}): number {
  const identity = parseRegistrationCategoryKey(input.categoryKey)
  if (!identity) return 5
  const override = input.overrides[identity.ageDivisionId]
  if (override !== undefined) return override
  return defaultDurationMinutesForDivisionId(identity.ageDivisionId)
}

export function getDefaultDurationTable(): Array<{
  ageDivisionId: string
  label: string
  defaultMinutes: number
}> {
  return fseAgeDivisions.map((division) => ({
    ageDivisionId: division.id,
    label: division.label,
    defaultMinutes: defaultDurationMinutesForAge(division.ageMin, division.ageMax),
  }))
}
