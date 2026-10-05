import { describe, expect, it } from 'vitest'
import { BracketSystemRegistry } from '../core/registry'
import '../systems'

describe('deploy guard prerequisites', () => {
  it('has olympic v1 registered for published snapshot validation', () => {
    expect(BracketSystemRegistry.has('olympic', 1)).toBe(true)
  })

  it('has round_robin v1 registered', () => {
    expect(BracketSystemRegistry.has('round_robin', 1)).toBe(true)
  })

  it('has three_way v1 registered', () => {
    expect(BracketSystemRegistry.has('three_way', 1)).toBe(true)
  })

  it('deploy guard SQL uses COALESCE(systemOverride, autoSystemId)', async () => {
    const { readFile } = await import('node:fs/promises')
    const source = await readFile('lib/brackets/deployGuard.ts', 'utf8')
    expect(source).toContain('COALESCE(d."systemOverride", d."autoSystemId")')
  })
})
