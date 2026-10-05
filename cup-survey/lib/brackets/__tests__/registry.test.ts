import { describe, expect, it } from 'vitest'
import { BracketSystemRegistry } from '../core/registry'
import '../systems'

describe('BracketSystemRegistry', () => {
  it('getLatest returns champion v1', () => {
    const system = BracketSystemRegistry.getLatest('champion')
    expect(system.id).toBe('champion')
    expect(system.supportsBouts).toBe(false)
    expect(system.requiresFreshSeeding).toBe(false)
  })

  it('getLatest returns olympic v1', () => {
    const system = BracketSystemRegistry.getLatest('olympic')
    expect(system.id).toBe('olympic')
    expect(system.version).toBe(1)
    expect(system.requiresFreshSeeding).toBe(true)
  })

  it('get returns specific version', () => {
    const system = BracketSystemRegistry.get('round_robin', 1)
    expect(system.requiresFreshSeeding).toBe(false)
  })

  it('tryGetLatest returns null for unknown', () => {
    expect(BracketSystemRegistry.tryGetLatest('swiss')).toBeNull()
  })
})
