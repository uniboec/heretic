import { Prisma } from '@prisma/client'
import type { AgeDivisionDurationOverrides } from './boutDuration'
import { fseAgeDivisions } from '../config/fseCategories'

const VALID_DIVISION_IDS = new Set(fseAgeDivisions.map((division) => division.id))

export function serializeAgeDivisionDurationOverrides(
  overrides: AgeDivisionDurationOverrides | null | undefined,
): typeof Prisma.DbNull | Prisma.InputJsonValue {
  if (!overrides || Object.keys(overrides).length === 0) {
    return Prisma.DbNull
  }
  return overrides as Prisma.InputJsonValue
}

export function validateAgeDivisionDurationOverridesPatch(
  overrides: AgeDivisionDurationOverrides,
): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (!VALID_DIVISION_IDS.has(key)) {
      throw new Error(`Unknown age division override key: ${key}`)
    }
    if (!Number.isInteger(value) || value < 1 || value > 60) {
      throw new Error(`Invalid duration override for ${key}`)
    }
  }
}
