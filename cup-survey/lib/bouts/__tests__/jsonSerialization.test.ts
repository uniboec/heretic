import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { serializeAgeDivisionDurationOverrides } from '../boutDuration.server'
import { serializeMatStartTimeOverrides } from '../startTimes.server'

describe('JSON override serialization', () => {
  it('serializes empty mat overrides to DbNull', () => {
    expect(serializeMatStartTimeOverrides({})).toBe(Prisma.DbNull)
    expect(serializeMatStartTimeOverrides(null)).toBe(Prisma.DbNull)
  })

  it('serializes empty duration overrides to DbNull', () => {
    expect(serializeAgeDivisionDurationOverrides({})).toBe(Prisma.DbNull)
    expect(serializeAgeDivisionDurationOverrides(null)).toBe(Prisma.DbNull)
  })
})
