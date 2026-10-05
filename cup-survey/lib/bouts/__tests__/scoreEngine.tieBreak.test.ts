import { describe, expect, it } from 'vitest'
import {
  buildPenaltyEventPayload,
  computeBoutLiveHints,
  reduceScoreEvents,
  resolveBoutDecision,
} from '../scoreEngine'
import type { BoutEventRecord, BoutParticipantContext } from '../mat-control/types'

const participants: BoutParticipantContext = {
  redEntryId: 'red-1',
  blueEntryId: 'blue-1',
  cornersSwapped: false,
}

function scoreEvent(input: Partial<BoutEventRecord> & Pick<BoutEventRecord, 'eventType'>): BoutEventRecord {
  return {
    id: input.id ?? `evt-${input.sequence ?? 1}`,
    boutId: 'bout-1',
    clientEventId: input.clientEventId ?? `client-${input.sequence ?? 1}`,
    sequence: input.sequence ?? 1,
    eventType: input.eventType,
    entryId: input.entryId ?? null,
    cornerAtEvent: input.cornerAtEvent ?? null,
    points: input.points ?? null,
    episodeId: input.episodeId ?? null,
    boutElapsedMs: input.boutElapsedMs ?? 0,
    period: input.period ?? 'main',
    attemptNumber: input.attemptNumber ?? 1,
    payload: input.payload ?? null,
    undoneAt: input.undoneAt ?? null,
    createdAt: input.createdAt ?? new Date(),
  }
}

describe('scoreEngine tie-break matrix', () => {
  it('resolves 8:8 by fewer penalties', () => {
    const events = [
      scoreEvent({ sequence: 1, eventType: 'TECHNICAL_SCORE', entryId: 'red-1', cornerAtEvent: 'red', points: 4 }),
      scoreEvent({ sequence: 2, eventType: 'TECHNICAL_SCORE', entryId: 'blue-1', cornerAtEvent: 'blue', points: 4 }),
      scoreEvent({ sequence: 3, eventType: 'TECHNICAL_SCORE', entryId: 'red-1', cornerAtEvent: 'red', points: 4 }),
      scoreEvent({ sequence: 4, eventType: 'TECHNICAL_SCORE', entryId: 'blue-1', cornerAtEvent: 'blue', points: 4 }),
      scoreEvent({
        sequence: 5,
        eventType: 'PENALTY',
        entryId: 'red-1',
        cornerAtEvent: 'red',
        points: 0,
        payload: buildPenaltyEventPayload({ ladder: 'GENERAL', sanction: 'REMARK' }),
      }),
    ]

    const decision = resolveBoutDecision({ events, period: 'main', attemptNumber: 1, participants })
    expect(decision.reason).toBe('FEWER_PENALTIES')
    expect(decision.winnerEntryId).toBe('blue-1')
  })

  it('resolves equal score by higher technical count at +4', () => {
    const events = [
      scoreEvent({ sequence: 1, eventType: 'TECHNICAL_SCORE', entryId: 'red-1', cornerAtEvent: 'red', points: 4 }),
      scoreEvent({ sequence: 2, eventType: 'TECHNICAL_SCORE', entryId: 'blue-1', cornerAtEvent: 'blue', points: 2 }),
      scoreEvent({ sequence: 3, eventType: 'TECHNICAL_SCORE', entryId: 'blue-1', cornerAtEvent: 'blue', points: 2 }),
    ]

    const decision = resolveBoutDecision({ events, period: 'main', attemptNumber: 1, participants })
    expect(decision.reason).toBe('HIGHER_TECHNICAL_SCORE')
    expect(decision.winnerEntryId).toBe('red-1')
  })

  it('marks clear advantage at score difference 10+', () => {
    const events = [
      scoreEvent({ sequence: 1, eventType: 'TECHNICAL_SCORE', entryId: 'red-1', cornerAtEvent: 'red', points: 4 }),
      scoreEvent({ sequence: 2, eventType: 'TECHNICAL_SCORE', entryId: 'red-1', cornerAtEvent: 'red', points: 4 }),
      scoreEvent({ sequence: 3, eventType: 'TECHNICAL_SCORE', entryId: 'red-1', cornerAtEvent: 'red', points: 2 }),
    ]

    const hints = computeBoutLiveHints({ events, period: 'main', attemptNumber: 1 })
    expect(hints.clearAdvantageEligible).toBe(true)
    expect(hints.leadingCorner).toBe('red')
    expect(reduceScoreEvents(events, 'main', 1).officialScore).toEqual({ red: 10, blue: 0 })
  })
})
