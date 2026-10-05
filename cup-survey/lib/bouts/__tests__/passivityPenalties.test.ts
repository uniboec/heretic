import { describe, expect, it } from 'vitest'
import {
  buildPassivityPenaltyPayloads,
  countPassivityPenaltiesInEpisode,
  countPassivityPenaltyStepsDue,
  PASSIVITY_PENALTY_INTERVAL_MS,
  resolvePassivityElapsedMs,
  resolvePassivityDuePenaltyPayloads,
} from '../passivityPenalties'
import { buildPenaltyEventPayload } from '../scoreEngine'
import type { BoutEventRecord } from '../mat-control/types'

function event(partial: Partial<BoutEventRecord> & Pick<BoutEventRecord, 'eventType'>): BoutEventRecord {
  return {
    id: partial.id ?? 'evt-1',
    boutId: 'bout-1',
    sequence: partial.sequence ?? 0,
    attemptNumber: 1,
    undoneAt: null,
    createdAt: partial.createdAt ?? new Date('2026-09-30T10:00:00.000Z'),
    clientEventId: partial.clientEventId ?? 'client-1',
    entryId: partial.entryId ?? 'red-1',
    cornerAtEvent: partial.cornerAtEvent ?? 'red',
    points: partial.points ?? null,
    episodeId: partial.episodeId ?? null,
    boutElapsedMs: partial.boutElapsedMs ?? null,
    period: partial.period ?? 'main',
    payload: partial.payload ?? null,
    eventType: partial.eventType,
  }
}

describe('passivityPenalties', () => {
  it('counts due penalty steps every 20 seconds', () => {
    expect(countPassivityPenaltyStepsDue(0, 0)).toBe(0)
    expect(countPassivityPenaltyStepsDue(PASSIVITY_PENALTY_INTERVAL_MS - 1, 0)).toBe(0)
    expect(countPassivityPenaltyStepsDue(PASSIVITY_PENALTY_INTERVAL_MS, 0)).toBe(1)
    expect(countPassivityPenaltyStepsDue(PASSIVITY_PENALTY_INTERVAL_MS * 2, 1)).toBe(1)
  })

  it('builds passivity ladder payloads without auto-disqualification', () => {
    const payloads = buildPassivityPenaltyPayloads({
      events: [],
      corner: 'red',
      period: 'main',
      attemptNumber: 1,
      stepsToApply: 4,
    })

    expect(payloads.map((payload) => payload.sanction)).toEqual([
      'WARNING_1',
      'WARNING_2',
      'WARNING_3',
    ])
    expect(payloads.every((payload) => payload.ladder === 'PASSIVITY')).toBe(true)
  })

  it('measures passivity elapsed time from bout clock, not wall clock', () => {
    const startedAt = new Date('2026-09-30T10:00:00.000Z')
    const now = new Date('2026-09-30T10:05:00.000Z')

    expect(
      resolvePassivityElapsedMs({
        passivityStartBoutElapsedMs: 10_000,
        execution: {
          clockState: 'stopped',
          clockStartedAt: null,
          clockElapsedBeforeStartMs: 18_000,
        },
        now,
      }),
    ).toBe(8_000)
  })

  it('applies due penalties only for active passivity episode', () => {
    const startedAt = new Date('2026-09-30T10:00:00.000Z')
    const now = new Date(startedAt.getTime() + PASSIVITY_PENALTY_INTERVAL_MS + 5_000)
    const events = [
      event({ eventType: 'PASSIVITY_START', createdAt: startedAt, boutElapsedMs: 0 }),
    ]

    const { payloads } = resolvePassivityDuePenaltyPayloads({
      events,
      corner: 'red',
      entryId: 'red-1',
      attemptNumber: 1,
      period: 'main',
      execution: {
        clockState: 'running',
        clockStartedAt: startedAt,
        clockElapsedBeforeStartMs: 0,
      },
      now,
    })

    expect(payloads).toEqual([buildPenaltyEventPayload({ ladder: 'PASSIVITY', sanction: 'WARNING_1' })])
    expect(
      countPassivityPenaltiesInEpisode({
        events: [
          ...events,
          event({
            id: 'penalty-1',
            eventType: 'PENALTY',
            createdAt: now,
            payload: payloads[0],
            points: 0,
          }),
        ],
        corner: 'red',
        passivityStartedAt: startedAt,
      }),
    ).toBe(1)
  })

  it('flags disqualification due when next ladder step is disqualification', () => {
    const startedAt = new Date('2026-09-30T10:00:00.000Z')
    const now = new Date(startedAt.getTime() + PASSIVITY_PENALTY_INTERVAL_MS * 4 + 5_000)
    const warningPayload = buildPenaltyEventPayload({ ladder: 'PASSIVITY', sanction: 'WARNING_1' })
    const events = [
      event({ eventType: 'PASSIVITY_START', createdAt: startedAt, boutElapsedMs: 0 }),
      event({
        id: 'penalty-1',
        eventType: 'PENALTY',
        createdAt: new Date(startedAt.getTime() + 20_000),
        payload: warningPayload,
        points: 0,
      }),
      event({
        id: 'penalty-2',
        eventType: 'PENALTY',
        createdAt: new Date(startedAt.getTime() + 40_000),
        payload: buildPenaltyEventPayload({ ladder: 'PASSIVITY', sanction: 'WARNING_2' }),
        points: 0,
      }),
      event({
        id: 'penalty-3',
        eventType: 'PENALTY',
        createdAt: new Date(startedAt.getTime() + 60_000),
        payload: buildPenaltyEventPayload({ ladder: 'PASSIVITY', sanction: 'WARNING_3' }),
        points: 0,
      }),
    ]

    const { payloads, disqualificationDue } = resolvePassivityDuePenaltyPayloads({
      events,
      corner: 'red',
      entryId: 'red-1',
      attemptNumber: 1,
      period: 'main',
      execution: {
        clockState: 'running',
        clockStartedAt: startedAt,
        clockElapsedBeforeStartMs: PASSIVITY_PENALTY_INTERVAL_MS * 4,
      },
      now,
    })

    expect(payloads).toEqual([])
    expect(disqualificationDue).toBe(true)
  })
})
