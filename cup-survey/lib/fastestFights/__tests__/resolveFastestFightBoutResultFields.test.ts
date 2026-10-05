import { describe, expect, it } from 'vitest'
import { resolveFastestFightBoutResultFields } from '../resolveFastestFightBoutResultFields'

describe('resolveFastestFightBoutResultFields', () => {
  it('stores ranking elapsed time only for eligible methods with positive elapsed', () => {
    const fields = resolveFastestFightBoutResultFields(
      'SUBMISSION',
      {
        eventId: 'stoppage-1',
        boutElapsedMs: 42_000,
        trigger: 'SUBMISSION',
      },
      { fightOfficiallyStarted: true },
    )

    expect(fields).toEqual({
      boutElapsedMs: 42_000,
      stoppageEventId: 'stoppage-1',
      stoppageTrigger: 'SUBMISSION',
    })
  })

  it('keeps audit snapshot but clears ranking time for FORFEIT', () => {
    const fields = resolveFastestFightBoutResultFields(
      'FORFEIT',
      {
        eventId: 'stoppage-2',
        boutElapsedMs: 12_000,
        trigger: 'FORFEIT',
      },
      { fightOfficiallyStarted: true },
    )

    expect(fields).toEqual({
      boutElapsedMs: null,
      stoppageEventId: 'stoppage-2',
      stoppageTrigger: 'FORFEIT',
    })
  })

  it('clears ranking time when fight clock never started', () => {
    const fields = resolveFastestFightBoutResultFields(
      'SUBMISSION',
      {
        eventId: 'stoppage-3',
        boutElapsedMs: 42_000,
        trigger: 'SUBMISSION',
      },
      { fightOfficiallyStarted: false },
    )

    expect(fields).toEqual({
      boutElapsedMs: null,
      stoppageEventId: 'stoppage-3',
      stoppageTrigger: 'SUBMISSION',
    })
  })

  it('clears ranking time for sub-second elapsed fights', () => {
    const fields = resolveFastestFightBoutResultFields(
      'CLEAR_ADVANTAGE',
      {
        eventId: 'stoppage-4',
        boutElapsedMs: 250,
        trigger: 'CLEAR_ADVANTAGE',
      },
      { fightOfficiallyStarted: true },
    )

    expect(fields).toEqual({
      boutElapsedMs: null,
      stoppageEventId: 'stoppage-4',
      stoppageTrigger: 'CLEAR_ADVANTAGE',
    })
  })

  it('returns null fields when there is no effective stoppage', () => {
    expect(
      resolveFastestFightBoutResultFields('SUBMISSION', null, { fightOfficiallyStarted: true }),
    ).toEqual({
      boutElapsedMs: null,
      stoppageEventId: null,
      stoppageTrigger: null,
    })
  })
})
