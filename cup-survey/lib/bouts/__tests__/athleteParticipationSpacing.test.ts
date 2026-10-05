import { describe, expect, it } from 'vitest'
import {
  DISABLED_ATHLETE_PARTICIPATION_SPACING,
  normalizeAthleteParticipationSpacing,
  requiredSpacingBetween,
  resolveSpacingTier,
} from '../athleteParticipationSpacing'
import { makeTestBout } from './testBoutHelpers'

describe('athleteParticipationSpacing', () => {
  it('null maps to disabled', () => {
    expect(normalizeAthleteParticipationSpacing(null)).toEqual(
      DISABLED_ATHLETE_PARTICIPATION_SPACING,
    )
  })

  it('enabled BOUT_COUNT uses defaults when values are low', () => {
    expect(
      normalizeAthleteParticipationSpacing({
        enabled: true,
        mode: 'BOUT_COUNT',
        regular: 1,
        medal: 3,
      }),
    ).toEqual({
      enabled: true,
      mode: 'BOUT_COUNT',
      regular: 2,
      medal: 5,
    })
  })

  it('requiredSpacingBetween uses max(prev, next)', () => {
    const regular = makeTestBout({ id: 'r1', schedulePhase: 'elimination' })
    const medal = makeTestBout({ id: 'm1', schedulePhase: 'final' })
    const settings = normalizeAthleteParticipationSpacing({
      enabled: true,
      mode: 'BOUT_COUNT',
      regular: 2,
      medal: 5,
    })

    expect(requiredSpacingBetween(regular, medal, settings)).toBe(5)
    expect(requiredSpacingBetween(medal, regular, settings)).toBe(5)
    expect(requiredSpacingBetween(regular, regular, settings)).toBe(2)
  })

  it('bronze is medal tier', () => {
    expect(resolveSpacingTier(makeTestBout({ id: 'b1', schedulePhase: 'bronze' }))).toBe('medal')
  })

  it('TIME mode defaults use 10/20 minutes when values are missing', () => {
    expect(
      normalizeAthleteParticipationSpacing({
        enabled: true,
        mode: 'TIME',
        regular: 0,
        medal: 0,
      }),
    ).toEqual({
      enabled: true,
      mode: 'TIME',
      regular: 10,
      medal: 20,
    })
  })
})
