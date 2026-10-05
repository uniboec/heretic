import { describe, expect, it } from 'vitest'
import { evaluateEvskNorm, getEvskAgeBand } from '../evskNorms'

describe('evskNorms', () => {
  it('maps age to EVSK bands', () => {
    expect(getEvskAgeBand(4)).toBe('child')
    expect(getEvskAgeBand(11)).toBe('child')
    expect(getEvskAgeBand(12)).toBe('youth')
    expect(getEvskAgeBand(17)).toBe('youth')
    expect(getEvskAgeBand(18)).toBe('adult')
  })

  it('evaluates youth III on 1st with 1 win', () => {
    const result = evaluateEvskNorm({
      placement: 1,
      wins: 1,
      ageBand: 'youth',
      eventLevel: 'regional_cup',
    })
    expect(result?.rankId).toBe('youth_3')
  })

  it('evaluates adult I only on 1st with 3 wins', () => {
    expect(
      evaluateEvskNorm({ placement: 1, wins: 2, ageBand: 'adult', eventLevel: 'regional_cup' })
        ?.rankId,
    ).toBe('adult_2')
    expect(
      evaluateEvskNorm({ placement: 1, wins: 3, ageBand: 'adult', eventLevel: 'regional_cup' })
        ?.rankId,
    ).toBe('adult_1')
  })

  it('evaluates child II on 1st with 2 wins for age-up band', () => {
    const result = evaluateEvskNorm({
      placement: 1,
      wins: 2,
      ageBand: 'child',
      eventLevel: 'regional_cup',
    })
    expect(result?.rankId).toBe('child_2')
  })
})
