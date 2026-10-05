import { describe, expect, it } from 'vitest'
import {
  buildPenaltyEventPayload,
  reduceScoreEvents,
  resolveBoutDecision,
  resolveEffectiveBoutDecision,
} from '../scoreEngine'
import type { BoutEventRecord, BoutParticipantContext } from '../mat-control/types'

const participants: BoutParticipantContext = {
  redEntryId: 'red-1',
  blueEntryId: 'blue-1',
  cornersSwapped: false,
}

function scoreEvent(input: Partial<BoutEventRecord> & Pick<BoutEventRecord, 'eventType'>): BoutEventRecord {
  return {
    id: input.id ?? 'evt-1',
    boutId: 'bout-1',
    clientEventId: input.clientEventId ?? 'client-1',
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

describe('scoreEngine', () => {
  it('awards PENALTY points to opponent', () => {
    const events = [
      scoreEvent({
        eventType: 'PENALTY',
        entryId: 'red-1',
        cornerAtEvent: 'red',
        points: 1,
        payload: buildPenaltyEventPayload({ ladder: 'GENERAL', sanction: 'WARNING_1' }),
      }),
    ]

    const state = reduceScoreEvents(events, 'main', 1)
    expect(state.officialScore).toEqual({ red: 0, blue: 1 })
  })

  it('does not walk back LAST_TECHNICAL on simultaneous episode', () => {
    const events = [
      scoreEvent({
        id: 'evt-1',
        sequence: 1,
        eventType: 'TECHNICAL_SCORE',
        entryId: 'red-1',
        cornerAtEvent: 'red',
        points: 2,
        episodeId: 'ep-1',
      }),
      scoreEvent({
        id: 'evt-2',
        sequence: 2,
        eventType: 'TECHNICAL_SCORE',
        entryId: 'blue-1',
        cornerAtEvent: 'blue',
        points: 2,
        episodeId: 'ep-1',
      }),
    ]

    const decision = resolveBoutDecision({
      events,
      period: 'main',
      attemptNumber: 1,
      participants,
    })

    expect(decision.reason).toBe('EXTRA_ROUND_REQUIRED')
    expect(decision.winnerEntryId).toBeNull()
  })

  it('resolveEffectiveBoutDecision prefers injury stoppage winner over 0:0 tie', () => {
    const events = [
      {
        id: 'stop-1',
        boutId: 'bout-1',
        clientEventId: 'stop-1',
        sequence: 1,
        eventType: 'BOUT_STOPPAGE',
        entryId: null,
        cornerAtEvent: null,
        points: null,
        episodeId: null,
        boutElapsedMs: 0,
        period: 'main',
        attemptNumber: 1,
        payload: {
          proposedVictoryMethod: 'INJURY',
          proposedDecisionReason: 'INJURY',
          winnerEntryId: 'blue-1',
          loserEntryId: 'red-1',
        },
        undoneAt: null,
        createdAt: new Date(),
      },
    ]

    const decision = resolveEffectiveBoutDecision({
      events,
      period: 'main',
      attemptNumber: 1,
      participants,
    })

    expect(decision.winnerEntryId).toBe('blue-1')
    expect(decision.loserEntryId).toBe('red-1')
    expect(decision.reason).toBe('INJURY')
  })
})
