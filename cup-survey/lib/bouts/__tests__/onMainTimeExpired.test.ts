import { describe, expect, it } from 'vitest'
import { onMainTimeExpired } from '../onMainTimeExpired'
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

describe('onMainTimeExpired', () => {
  it('starts extra round on tie at main time', () => {
    const events = [
      { ...technicalScore(1, 'red', 2), episodeId: 'ep-1' },
      { ...technicalScore(2, 'blue', 2), episodeId: 'ep-1' },
    ]

    const result = onMainTimeExpired({
      execution: baseExecution({
        boutPhase: 'live',
        clockState: 'running',
        officialStartedAt: new Date('2026-09-30T10:00:00.000Z'),
      }),
      events,
      participants,
      now: new Date('2026-09-30T10:03:00.000Z'),
    })

    expect(result.execution.currentPeriod).toBe('extra')
    expect(result.execution.officialEndedAt).toBeNull()
    expect(result.createdEvents).toHaveLength(0)
  })

  it('creates stoppage when main time has winner', () => {
    const result = onMainTimeExpired({
      execution: baseExecution({
        boutPhase: 'live',
        clockState: 'running',
        officialStartedAt: new Date('2026-09-30T10:00:00.000Z'),
      }),
      events: [technicalScore(1, 'red', 4)],
      participants,
      now: new Date('2026-09-30T10:03:00.000Z'),
    })

    expect(result.execution.boutPhase).toBe('pending_confirmation')
    expect(result.execution.officialEndedAt).not.toBeNull()
    expect(result.createdEvents[0]?.eventType).toBe('BOUT_STOPPAGE')
  })
})
