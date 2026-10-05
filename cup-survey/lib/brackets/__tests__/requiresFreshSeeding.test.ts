import { describe, expect, it } from 'vitest'
import { BracketSystemRegistry } from '../core/registry'
import '../systems'

describe('requiresFreshSeeding gate', () => {
  it('olympic requires fresh seeding', () => {
    const system = BracketSystemRegistry.getLatest('olympic')
    expect(system.requiresFreshSeeding).toBe(true)
  })

  it('round_robin does not require fresh seeding', () => {
    const system = BracketSystemRegistry.getLatest('round_robin')
    expect(system.requiresFreshSeeding).toBe(false)
  })
})
