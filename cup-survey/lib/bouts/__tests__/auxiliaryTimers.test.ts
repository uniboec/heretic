import { describe, expect, it } from 'vitest'
import { computeAuxiliaryTimers } from '../auxiliaryTimers'
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
    entryId: partial.entryId ?? null,
    cornerAtEvent: partial.cornerAtEvent ?? null,
    points: partial.points ?? null,
    episodeId: partial.episodeId ?? null,
    boutElapsedMs: partial.boutElapsedMs ?? null,
    period: partial.period ?? 'main',
    payload: partial.payload ?? null,
    eventType: partial.eventType,
  }
}

describe('computeAuxiliaryTimers', () => {
  it('restores secondary call countdown per corner', () => {
    const startedAt = new Date('2026-09-30T10:00:00.000Z')
    const now = new Date(startedAt.getTime() + 30_000)
    const timers = computeAuxiliaryTimers({
      attemptNumber: 1,
      execution: {
        clockState: 'stopped',
        clockStartedAt: null,
        clockElapsedBeforeStartMs: 0,
      },
      events: [
        event({
          eventType: 'FIRST_CALL',
          entryId: 'red-1',
          cornerAtEvent: 'red',
          createdAt: new Date('2026-09-30T09:58:00.000Z'),
        }),
        event({
          eventType: 'FIRST_CALL',
          entryId: 'blue-1',
          cornerAtEvent: 'blue',
          createdAt: new Date('2026-09-30T09:59:00.000Z'),
        }),
        event({
          eventType: 'SECONDARY_CALL',
          entryId: 'red-1',
          cornerAtEvent: 'red',
          createdAt: startedAt,
        }),
      ],
      participants: { redEntryId: 'red-1', blueEntryId: 'blue-1', cornersSwapped: false },
      now,
    })

    expect(timers.secondaryCalls?.red?.remainingMs).toBe(90_000)
    expect(timers.secondaryCalls?.blue).toBeUndefined()
  })

  it('tracks open passivity timer from bout clock while running', () => {
    const startedAt = new Date('2026-09-30T10:00:00.000Z')
    const now = new Date('2026-09-30T10:00:15.000Z')
    const timers = computeAuxiliaryTimers({
      attemptNumber: 1,
      execution: {
        boutPhase: 'live',
        clockState: 'running',
        clockStartedAt: startedAt,
        clockElapsedBeforeStartMs: 0,
      },
      events: [
        event({
          eventType: 'PASSIVITY_START',
          entryId: 'red-1',
          cornerAtEvent: 'red',
          createdAt: startedAt,
          boutElapsedMs: 0,
        }),
      ],
      participants: { redEntryId: 'red-1', blueEntryId: 'blue-1', cornersSwapped: false },
      now,
    })

    expect(timers.passivity?.elapsedMs).toBe(15_000)
  })

  it('pauses passivity timer when fight clock is stopped', () => {
    const startedAt = new Date('2026-09-30T10:00:00.000Z')
    const timers = computeAuxiliaryTimers({
      attemptNumber: 1,
      execution: {
        boutPhase: 'live',
        clockState: 'stopped',
        clockStartedAt: null,
        clockElapsedBeforeStartMs: 8_000,
      },
      events: [
        event({
          eventType: 'PASSIVITY_START',
          entryId: 'red-1',
          cornerAtEvent: 'red',
          createdAt: startedAt,
          boutElapsedMs: 0,
        }),
      ],
      participants: { redEntryId: 'red-1', blueEntryId: 'blue-1', cornersSwapped: false },
      now: new Date('2026-09-30T10:05:00.000Z'),
    })

    expect(timers.passivity?.elapsedMs).toBe(8_000)
  })

  it('omits passivity timer when bout is not live', () => {
    const timers = computeAuxiliaryTimers({
      attemptNumber: 1,
      execution: {
        boutPhase: 'pending_confirmation',
        clockState: 'stopped',
        clockStartedAt: null,
        clockElapsedBeforeStartMs: 20_000,
      },
      events: [
        event({
          eventType: 'PASSIVITY_START',
          entryId: 'red-1',
          cornerAtEvent: 'red',
          createdAt: new Date('2026-09-30T10:00:00.000Z'),
          boutElapsedMs: 0,
        }),
      ],
      participants: { redEntryId: 'red-1', blueEntryId: 'blue-1', cornersSwapped: false },
      now: new Date('2026-09-30T10:05:00.000Z'),
    })

    expect(timers.passivity).toBeUndefined()
  })

  it('tracks active athlete doctor visit', () => {
    const now = new Date('2026-09-30T10:00:15.000Z')
    const timers = computeAuxiliaryTimers({
      attemptNumber: 1,
      execution: {
        clockState: 'stopped',
        clockStartedAt: null,
        clockElapsedBeforeStartMs: 0,
      },
      events: [
        event({
          eventType: 'ATHLETE_DOCTOR_START',
          entryId: 'red-1',
          cornerAtEvent: 'red',
          createdAt: new Date('2026-09-30T10:00:05.000Z'),
        }),
      ],
      participants: { redEntryId: 'red-1', blueEntryId: 'blue-1', cornersSwapped: false },
      now,
    })

    expect(timers.athleteDoctorVisits?.red?.totalMs).toBe(10_000)
    expect(timers.athleteDoctorVisits?.red?.isActive).toBe(true)
  })
})
