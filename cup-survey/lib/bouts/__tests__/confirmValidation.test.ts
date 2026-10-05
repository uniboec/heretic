import { describe, expect, it } from 'vitest'
import type { BoutEventRecord } from '../mat-control/types'
import {
  assertConfirmBoutValid,
  ConfirmValidationError,
  DEFAULT_REQUIRES_OFFICIAL_START,
  getBlockingConfirmIssues,
  getConfirmDisabledReason,
  requiresOfficialStartForMethod,
  validateConfirmBout,
} from '../confirmValidation'

function clockStartEvent(overrides: Partial<BoutEventRecord> = {}): BoutEventRecord {
  return {
    id: 'evt-clock',
    boutId: 'bout-1',
    clientEventId: 'clock-1',
    sequence: 0,
    eventType: 'CLOCK_START',
    entryId: null,
    cornerAtEvent: null,
    points: null,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload: null,
    undoneAt: null,
    createdAt: new Date('2026-09-30T10:00:00.000Z'),
    ...overrides,
  }
}

function technicalScore(points: number, boutElapsedMs = 60_000): BoutEventRecord {
  return {
    id: `evt-score-${points}`,
    boutId: 'bout-1',
    clientEventId: `score-${points}`,
    sequence: 1,
    eventType: 'TECHNICAL_SCORE',
    entryId: 'red-1',
    cornerAtEvent: 'red',
    points,
    episodeId: 'ep-1',
    boutElapsedMs,
    period: 'main',
    attemptNumber: 1,
    payload: { source: 'DIRECT' },
    undoneAt: null,
    createdAt: new Date('2026-09-30T10:01:00.000Z'),
  }
}

describe('confirmValidation', () => {
  it('requires official clock start for POINTS by default', () => {
    const issues = validateConfirmBout({
      victoryMethod: 'POINTS',
      events: [technicalScore(1)],
      attemptNumber: 1,
      period: 'main',
    })
    expect(issues.some((i) => i.code === 'CLOCK_START_REQUIRED')).toBe(true)
  })

  it('allows FORFEIT without clock start', () => {
    const issues = validateConfirmBout({
      victoryMethod: 'FORFEIT',
      events: [],
      attemptNumber: 1,
      period: 'main',
    })
    expect(issues).toHaveLength(0)
  })

  it('passes POINTS when clock started', () => {
    const issues = validateConfirmBout({
      victoryMethod: 'POINTS',
      events: [clockStartEvent(), technicalScore(1, 120_000)],
      attemptNumber: 1,
      period: 'main',
    })
    expect(issues.filter((i) => i.code === 'CLOCK_START_REQUIRED')).toHaveLength(0)
  })

  it('blocks INJURY with technical score until acknowledged', () => {
    const issues = validateConfirmBout({
      victoryMethod: 'INJURY',
      events: [clockStartEvent(), technicalScore(2)],
      attemptNumber: 1,
      period: 'main',
    })
    expect(issues.some((i) => i.code === 'INJURY_WITH_TECHNICAL_SCORE')).toBe(true)
    expect(
      getBlockingConfirmIssues(issues).some((i) => i.code === 'INJURY_WITH_TECHNICAL_SCORE'),
    ).toBe(true)
  })

  it('warns on suspiciously short POINTS fight', () => {
    const issues = validateConfirmBout({
      victoryMethod: 'POINTS',
      events: [clockStartEvent(), technicalScore(1, 5_000)],
      attemptNumber: 1,
      period: 'main',
    })
    expect(issues.some((i) => i.code === 'POINTS_SUSPICIOUSLY_SHORT')).toBe(true)
    expect(getBlockingConfirmIssues(issues)).toHaveLength(0)
  })

  it('assertConfirmBoutValid throws ConfirmValidationError', () => {
    expect(() =>
      assertConfirmBoutValid({
        victoryMethod: 'POINTS',
        events: [],
        attemptNumber: 1,
        period: 'main',
      }),
    ).toThrow(ConfirmValidationError)
  })

  it('getConfirmDisabledReason returns first blocking message', () => {
    const reason = getConfirmDisabledReason({
      victoryMethod: 'CLEAR_ADVANTAGE',
      events: [],
      attemptNumber: 1,
      period: 'main',
    })
    expect(reason).toContain('официальный старт')
  })

  it('requiresOfficialStartForMethod respects config override', () => {
    expect(requiresOfficialStartForMethod('POINTS', DEFAULT_REQUIRES_OFFICIAL_START)).toBe(true)
    expect(requiresOfficialStartForMethod('FORFEIT', DEFAULT_REQUIRES_OFFICIAL_START)).toBe(false)
    expect(requiresOfficialStartForMethod('UNKNOWN' as 'POINTS', {})).toBe(false)
  })
})
