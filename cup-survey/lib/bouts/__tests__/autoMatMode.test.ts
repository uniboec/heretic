import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  getEffectiveAutoMatAssignMode,
  isCategoryBatchMode,
  isTimeWeightedMode,
} from '../autoMatMode'

const autoMatModeSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../autoMatMode.ts'),
  'utf8',
)

describe('autoMatMode', () => {
  it('has no server-only runtime imports', () => {
    expect(autoMatModeSource).not.toMatch(/from ['"]@prisma\/client['"]/)
    expect(autoMatModeSource).not.toMatch(/from ['"].*\/prisma['"]/)
  })

  describe('getEffectiveAutoMatAssignMode', () => {
    it('coerces category count mode to BY_BOUT when marker is off', () => {
      expect(
        getEffectiveAutoMatAssignMode({
          autoMatByCategoryEnabled: false,
          autoMatAssignMode: 'BY_CATEGORY',
        }),
      ).toBe('BY_BOUT')
    })

    it('coerces category time mode to BY_BOUT_TIME when marker is off', () => {
      expect(
        getEffectiveAutoMatAssignMode({
          autoMatByCategoryEnabled: false,
          autoMatAssignMode: 'BY_CATEGORY_TIME',
        }),
      ).toBe('BY_BOUT_TIME')
    })

    it('keeps BY_BOUT_TIME when marker is off', () => {
      expect(
        getEffectiveAutoMatAssignMode({
          autoMatByCategoryEnabled: false,
          autoMatAssignMode: 'BY_BOUT_TIME',
        }),
      ).toBe('BY_BOUT_TIME')
    })

    it('returns stored mode when marker is on', () => {
      expect(
        getEffectiveAutoMatAssignMode({
          autoMatByCategoryEnabled: true,
          autoMatAssignMode: 'BY_CATEGORY_TIME',
        }),
      ).toBe('BY_CATEGORY_TIME')
    })
  })

  describe('mode helpers', () => {
    it('isCategoryBatchMode', () => {
      expect(isCategoryBatchMode('BY_CATEGORY')).toBe(true)
      expect(isCategoryBatchMode('BY_CATEGORY_TIME')).toBe(true)
      expect(isCategoryBatchMode('BY_BOUT')).toBe(false)
      expect(isCategoryBatchMode('BY_BOUT_TIME')).toBe(false)
    })

    it('isTimeWeightedMode', () => {
      expect(isTimeWeightedMode('BY_BOUT_TIME')).toBe(true)
      expect(isTimeWeightedMode('BY_CATEGORY_TIME')).toBe(true)
      expect(isTimeWeightedMode('BY_BOUT')).toBe(false)
      expect(isTimeWeightedMode('BY_CATEGORY')).toBe(false)
    })
  })
})
