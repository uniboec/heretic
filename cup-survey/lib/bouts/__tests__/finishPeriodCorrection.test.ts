import { describe, expect, it } from 'vitest'
import { finishPeriodCorrection } from '../finishPeriodCorrection'
import type { BoutEventRecord, BoutParticipantContext } from '../mat-control/types'
import { baseExecution } from './matControlTestHelpers'

const participants: BoutParticipantContext = {
  redEntryId: 'red-1',
  blueEntryId: 'blue-1',
  cornersSwapped: false,
}

function technicalScore(sequence: number, corner: 'red' | 'blue', points: number): BoutEventRecord {
  const entryId = corner === 'red' ? 'red-1' : 'blue-1'
  return {
    id: `evt-${sequence}`,
    boutId: 'bout-1',
    clientEventId: `client-${sequence}`,
    sequence,
    eventType: 'TECHNICAL_SCORE',
    entryId,
    cornerAtEvent: corner,
    points,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload: null,
    undoneAt: null,
    createdAt: new Date(),
  }
}

describe('finishPeriodCorrection', () => {
  it('re-resolves main period into extra round after correction', () => {
    const result = finishPeriodCorrection({
      execution: baseExecution({
        boutPhase: 'live',
        periodCorrectionMode: true,
        currentPeriod: 'main',
        mainEndedAt: new Date('2026-09-30T10:03:00.000Z'),
      }),
      events: [
        { ...technicalScore(1, 'red', 2), episodeId: 'ep-1' },
        { ...technicalScore(2, 'blue', 2), episodeId: 'ep-1' },
      ],
      participants,
      now: new Date('2026-09-30T10:03:30.000Z'),
    })

    expect(result.execution.periodCorrectionMode).toBe(false)
    expect(result.execution.currentPeriod).toBe('extra')
    expect(result.stoppageEvent).toBeUndefined()
  })

  it('re-resolves extra period into pending_activity_decision after correction', () => {
    const result = finishPeriodCorrection({
      execution: baseExecution({
        boutPhase: 'live',
        periodCorrectionMode: true,
        currentPeriod: 'extra',
        mainEndedAt: new Date('2026-09-30T10:03:00.000Z'),
        extraEndedAt: new Date('2026-09-30T10:06:00.000Z'),
      }),
      events: [
        { ...technicalScore(1, 'red', 2), period: 'extra', episodeId: 'ep-extra-last' },
        { ...technicalScore(2, 'blue', 2), period: 'extra', episodeId: 'ep-extra-last' },
      ],
      participants,
      now: new Date('2026-09-30T10:06:30.000Z'),
    })

    expect(result.execution.periodCorrectionMode).toBe(false)
    expect(result.execution.boutPhase).toBe('pending_activity_decision')
    expect(result.stoppageEvent).toBeUndefined()
  })
})
