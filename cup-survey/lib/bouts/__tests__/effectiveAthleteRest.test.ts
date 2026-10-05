import { describe, expect, it } from 'vitest'
import {
  computeAthleteParticipationSpacingRestUntil,
  computeEffectiveRestUntil,
  isBeforeEffectiveRest,
  maxRestUntil,
} from '../effectiveAthleteRest'
import { normalizeAthleteParticipationSpacing } from '../athleteParticipationSpacing'
import { makeTestBout } from './testBoutHelpers'

describe('effectiveAthleteRest', () => {
  const timeSpacing = normalizeAthleteParticipationSpacing({
    enabled: true,
    mode: 'TIME',
    regular: 10,
    medal: 20,
  })
  const disabledSpacing = normalizeAthleteParticipationSpacing({ enabled: false })

  it('maxRestUntil picks the latest date', () => {
    const earlier = new Date('2026-10-03T10:00:00.000Z')
    const later = new Date('2026-10-03T10:20:00.000Z')
    expect(maxRestUntil([earlier, later])).toEqual(later)
  })

  it('computeEffectiveRestUntil uses max(existing, spacing)', () => {
    const existing = new Date('2026-10-03T10:15:00.000Z')
    const spacing = new Date('2026-10-03T10:05:00.000Z')
    expect(computeEffectiveRestUntil({ existingRestUntil: existing, spacingRestUntil: spacing })).toEqual(
      existing,
    )
  })

  it('spacing rest is null when spacing disabled', () => {
    const previous = makeTestBout({ id: 'b1', categoryKey: 'cat' })
    const next = makeTestBout({ id: 'b2', categoryKey: 'cat' })
    expect(
      computeAthleteParticipationSpacingRestUntil({
        previousBout: previous,
        nextBout: next,
        previousEndedAt: new Date('2026-10-03T10:00:00.000Z'),
        settings: disabledSpacing,
      }),
    ).toBeNull()
  })

  it('TIME spacing rest uses max(prev, next) minutes', () => {
    const regular = makeTestBout({ id: 'r1', schedulePhase: 'elimination' })
    const medal = makeTestBout({ id: 'm1', schedulePhase: 'final' })
    const endedAt = new Date('2026-10-03T10:00:00.000Z')
    const restUntil = computeAthleteParticipationSpacingRestUntil({
      previousBout: regular,
      nextBout: medal,
      previousEndedAt: endedAt,
      settings: timeSpacing,
    })
    expect(restUntil?.toISOString()).toBe('2026-10-03T10:20:00.000Z')
  })

  it('isBeforeEffectiveRest returns false when rest has passed', () => {
    expect(
      isBeforeEffectiveRest(new Date('2026-10-03T11:00:00.000Z'), new Date('2026-10-03T10:00:00.000Z')),
    ).toBe(false)
  })
})
