import { describe, expect, it } from 'vitest'
import type { BoutEventRecord } from '../mat-control/types'
import { CommandNotAllowedError } from '../mat-control/errors'
import {
  assertDirectTechnicalScoreAllowed,
  hasPriorScoringChronology,
} from '../directScoreValidation'

function adjudicationScore(): BoutEventRecord {
  return {
    id: 'evt-adj',
    boutId: 'bout-1',
    clientEventId: 'adj-1',
    sequence: 0,
    eventType: 'TECHNICAL_SCORE',
    entryId: 'red-1',
    cornerAtEvent: 'red',
    points: 1,
    episodeId: 'ep-1',
    boutElapsedMs: 1000,
    period: 'main',
    attemptNumber: 1,
    payload: { source: 'ADJUDICATION' },
    undoneAt: null,
    createdAt: new Date(),
  }
}

describe('directScoreValidation', () => {
  it('detects prior non-direct scoring chronology', () => {
    expect(hasPriorScoringChronology([adjudicationScore()], 1)).toBe(true)
    expect(hasPriorScoringChronology([], 1)).toBe(false)
  })

  it('allows zero direct points without history', () => {
    expect(() =>
      assertDirectTechnicalScoreAllowed({
        events: [],
        attemptNumber: 1,
        points: 0,
        payload: { source: 'DIRECT' },
      }),
    ).not.toThrow()
  })

  it('blocks positive direct score without chronology', () => {
    expect(() =>
      assertDirectTechnicalScoreAllowed({
        events: [],
        attemptNumber: 1,
        points: 1,
        payload: { source: 'DIRECT' },
      }),
    ).toThrow(CommandNotAllowedError)
  })

  it('allows direct score with admin override reason', () => {
    expect(() =>
      assertDirectTechnicalScoreAllowed({
        events: [],
        attemptNumber: 1,
        points: 3,
        payload: { source: 'DIRECT', adminOverrideReason: 'operator correction' },
      }),
    ).not.toThrow()
  })

  it('allows direct score when adjudication history exists', () => {
    expect(() =>
      assertDirectTechnicalScoreAllowed({
        events: [adjudicationScore()],
        attemptNumber: 1,
        points: 1,
        payload: { source: 'DIRECT' },
      }),
    ).not.toThrow()
  })

  it('allows follow-up direct score after first scored event', () => {
    const firstDirect = adjudicationScore()
    firstDirect.payload = { source: 'DIRECT', adminOverrideReason: 'bootstrap' }
    expect(() =>
      assertDirectTechnicalScoreAllowed({
        events: [firstDirect],
        attemptNumber: 1,
        points: 2,
        payload: { source: 'DIRECT' },
      }),
    ).not.toThrow()
  })
})
