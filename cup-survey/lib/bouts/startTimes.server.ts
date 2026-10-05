import { Prisma } from '@prisma/client'
import type { MatStartTimeOverrides } from './startTimes.types'
import { MAT_KEYS, type MatKey } from './startTimes.types'
import { isValidLocalTime } from './startTimes'

export function serializeMatStartTimeOverrides(
  overrides: MatStartTimeOverrides | null | undefined,
): typeof Prisma.DbNull | Prisma.InputJsonValue {
  if (!overrides || Object.keys(overrides).length === 0) {
    return Prisma.DbNull
  }
  return overrides as Prisma.InputJsonValue
}

export function validateMatStartTimeOverridesForMatCount(
  overrides: MatStartTimeOverrides,
  matCount: number,
): void {
  for (const key of Object.keys(overrides)) {
    if (!MAT_KEYS.includes(key as MatKey)) {
      throw new Error(`Invalid mat override key: ${key}`)
    }
    const matIndex = Number(key)
    if (matIndex < 1 || matIndex > matCount) {
      throw new Error(`Mat override key ${key} exceeds matCount ${matCount}`)
    }
    const value = overrides[key as MatKey]
    if (value !== undefined && !isValidLocalTime(value)) {
      throw new Error(`Invalid mat override time for key ${key}`)
    }
  }
}
