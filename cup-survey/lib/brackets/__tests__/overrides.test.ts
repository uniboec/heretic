import { describe, expect, it } from 'vitest'
import { validateOverrides } from '../core/formatRules'
import '../systems'

const rule = {
  id: 'r1',
  minParticipants: 4,
  maxParticipants: 5,
  systemId: 'olympic',
  defaultBronzeMode: 'TWO' as const,
  allowedSystemIds: ['olympic', 'round_robin'],
  sortOrder: 0,
  enabled: true,
}

describe('validateOverrides', () => {
  it('clears RR override when N changes 5→6 and RR not allowed', () => {
    const at5 = validateOverrides('key', 5, rule, 'olympic', 'TWO', 'round_robin', null)
    expect(at5.systemOverride).toBe('round_robin')
    const olympicOnlyRule = { ...rule, minParticipants: 6, maxParticipants: 32, allowedSystemIds: ['olympic'] }
    const at6 = validateOverrides('key', 6, olympicOnlyRule, 'olympic', 'TWO', 'round_robin', null)
    expect(at6.systemOverride).toBeNull()
    expect(at6.warnings.some((w) => w.code === 'SYSTEM_OVERRIDE_CLEARED')).toBe(true)
  })

  it('clears RR override when N=6 and RR not allowed', () => {
    const olympicOnlyRule = { ...rule, minParticipants: 6, maxParticipants: 32, allowedSystemIds: ['olympic'] }
    const result = validateOverrides('key', 6, olympicOnlyRule, 'olympic', 'TWO', 'round_robin', null)
    expect(result.systemOverride).toBeNull()
    expect(result.warnings.some((w) => w.code === 'SYSTEM_OVERRIDE_CLEARED')).toBe(true)
  })

  it('clears bronze override when switching to round robin', () => {
    const result = validateOverrides('key', 5, rule, 'olympic', 'TWO', 'round_robin', 'ONE')
    expect(result.bronzeModeOverride).toBeNull()
    expect(result.warnings.some((w) => w.code === 'BRONZE_OVERRIDE_CLEARED')).toBe(true)
  })

  it('clears bronze override when N drops below 4', () => {
    const result = validateOverrides('key', 3, rule, 'olympic', 'TWO', null, 'ONE')
    expect(result.bronzeModeOverride).toBeNull()
    expect(result.warnings.some((w) => w.code === 'BRONZE_OVERRIDE_CLEARED')).toBe(true)
  })
})
