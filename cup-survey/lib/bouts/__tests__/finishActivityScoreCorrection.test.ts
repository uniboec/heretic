import { describe, expect, it } from 'vitest'
import { finishActivityScoreCorrection } from '../finishActivityScoreCorrection'
import type { BoutEventRecord, BoutParticipantContext } from '../mat-control/types'
import { baseExecution } from './matControlTestHelpers'

const participants: BoutParticipantContext = {
  redEntryId: 'red-1',
  blueEntryId: 'blue-1',
  cornersSwapped: false,
}

function technicalScore(
  sequence: number,
  corner: 'red' | 'blue',
  points: number,
  period: 'main' | 'extra' = 'extra',
): BoutEventRecord {
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
    episodeId: `ep-${sequence}`,
    boutElapsedMs: 0,
    period,
    attemptNumber: 1,
    payload: { source: 'DIRECT' },
    undoneAt: null,
    createdAt: new Date(),
  }
}

describe('finishActivityScoreCorrection', () => {
  it('returns to pending_activity_decision when extra remains tied', () => {
    const result = finishActivityScoreCorrection({
      execution: baseExecution({
        boutPhase: 'pending_activity_decision',
        activityCorrectionMode: true,
        currentPeriod: 'extra',
        extraEndedAt: new Date('2026-09-30T10:06:00.000Z'),
        officialEndedAt: new Date('2026-09-30T10:06:00.000Z'),
      }),
      events: [
        technicalScore(1, 'red', 2, 'main'),
        technicalScore(2, 'blue', 2, 'main'),
        { ...technicalScore(3, 'red', 2, 'extra'), episodeId: 'ep-extra-last' },
        { ...technicalScore(4, 'blue', 2, 'extra'), episodeId: 'ep-extra-last' },
      ],
      participants,
      now: new Date('2026-09-30T10:07:00.000Z'),
    })

    expect(result.execution.activityCorrectionMode).toBe(false)
    expect(result.execution.boutPhase).toBe('pending_activity_decision')
    expect(result.stoppageEvent).toBeUndefined()
  })

  it('creates stoppage when correction yields objective extra winner', () => {
    const result = finishActivityScoreCorrection({
      execution: baseExecution({
        boutPhase: 'pending_activity_decision',
        activityCorrectionMode: true,
        currentPeriod: 'extra',
        extraEndedAt: new Date('2026-09-30T10:06:00.000Z'),
        officialEndedAt: new Date('2026-09-30T10:06:00.000Z'),
      }),
      events: [
        technicalScore(1, 'red', 2, 'main'),
        technicalScore(2, 'blue', 2, 'main'),
        technicalScore(3, 'red', 2, 'extra'),
        technicalScore(4, 'blue', 2, 'extra'),
        technicalScore(5, 'red', 2, 'extra'),
      ],
      participants,
      now: new Date('2026-09-30T10:07:00.000Z'),
    })

    expect(result.execution.activityCorrectionMode).toBe(false)
    expect(result.execution.boutPhase).toBe('pending_confirmation')
    expect(result.stoppageEvent?.payload).toMatchObject({
      winnerEntryId: 'red-1',
      loserEntryId: 'blue-1',
      trigger: 'ACTIVITY_CORRECTION',
    })
  })
})
