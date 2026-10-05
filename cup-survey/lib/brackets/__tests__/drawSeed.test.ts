import { describe, expect, it } from 'vitest'
import { hashDrawSeed } from '../core/hash'

describe('per-category drawSeed', () => {
  it('changes when redrawRevision increments', () => {
    const base = 'base-seed'
    const key = 'tactic_control:novice:m_juniors_1:w_66'
    const s0 = hashDrawSeed(base, key, 0)
    const s1 = hashDrawSeed(base, key, 1)
    expect(s0).not.toBe(s1)
  })

  it('does not change other categories when one redraws', () => {
    const base = 'base-seed'
    const catA = 'cat-a'
    const catB = 'cat-b'
    const a0 = hashDrawSeed(base, catA, 0)
    const b0 = hashDrawSeed(base, catB, 0)
    const a1 = hashDrawSeed(base, catA, 1)
    expect(hashDrawSeed(base, catB, 0)).toBe(b0)
    expect(a1).not.toBe(a0)
  })
})
