import { describe, expect, it } from 'vitest'
import { expirePeriod } from '../expirePeriod'
import { CommandNotAllowedError, PeriodNotExpiredError } from '../mat-control/errors'
import type { BoutEventRecord, BoutParticipantContext, MatControlExecution } from '../mat-control/types'

const participants: BoutParticipantContext = {
  redEntryId: 'red-1',
  blueEntryId: 'blue-1',
  cornersSwapped: false,
}

const baseExecution: MatControlExecution = {
  id: 'exec-1',
  boutId: 'bout-1',
  tournamentScopeId: 'cup-2026',
  actualStartAt: null,
  actualEndAt: null,
  officialStartedAt: new Date('2026-09-30T10:00:00.000Z'),
  officialEndedAt: null,
  mainEndedAt: null,
  extraEndedAt: null,
  activityCorrectionMode: false,
  periodCorrectionMode: false,
  attemptNumber: 1,
  boutPhase: 'live',
  clockState: 'running',
  clockStartedAt: new Date('2026-09-30T10:00:00.000Z'),
  clockElapsedBeforeStartMs: 0,
  currentPeriod: 'main',
  nextEventSequence: 0,
  liveRevision: 0,
  liveSnapshot: null,
}

describe('expirePeriod', () => {
  it('rejects expiry before deadline', () => {
    const now = new Date('2026-09-30T10:01:00.000Z')
    expect(() =>
      expirePeriod({
        execution: baseExecution,
        events: [],
        participants,
        period: 'main',
        periodDurationMs: 180_000,
        now,
      }),
    ).toThrow(PeriodNotExpiredError)
  })

  it('records period end after deadline', () => {
    const now = new Date('2026-09-30T10:03:30.000Z')
    const result = expirePeriod({
      execution: baseExecution,
      events: [],
      participants,
      period: 'main',
      periodDurationMs: 180_000,
      now,
    })

    expect(result.execution.mainEndedAt).not.toBeNull()
    expect(result.execution.currentPeriod).toBe('extra')
  })

  it('persists PERIOD_ENDED when main tie starts extra round', () => {
    const now = new Date('2026-09-30T10:03:30.000Z')
    const result = expirePeriod({
      execution: baseExecution,
      events: [],
      participants,
      period: 'main',
      periodDurationMs: 180_000,
      now,
    })

    expect(result.execution.currentPeriod).toBe('extra')
    expect(result.createdEvents).toHaveLength(1)
    expect(result.createdEvents[0]?.eventType).toBe('PERIOD_ENDED')
  })

  it('rejects expiry for a non-current period', () => {
    expect(() =>
      expirePeriod({
        execution: baseExecution,
        events: [],
        participants,
        period: 'extra',
        periodDurationMs: 180_000,
        now: new Date('2026-09-30T10:03:30.000Z'),
      }),
    ).toThrow(CommandNotAllowedError)
  })

  it('rejects expiry while clock is stopped before period duration elapses', () => {
    expect(() =>
      expirePeriod({
        execution: {
          ...baseExecution,
          clockState: 'stopped',
          clockStartedAt: null,
          clockElapsedBeforeStartMs: 60_000,
        },
        events: [],
        participants,
        period: 'main',
        periodDurationMs: 180_000,
        now: new Date('2026-09-30T10:01:00.000Z'),
      }),
    ).toThrow(PeriodNotExpiredError)
  })

  it('is idempotent when period already ended', () => {
    const endedExecution = {
      ...baseExecution,
      mainEndedAt: new Date('2026-09-30T10:03:00.000Z'),
      nextEventSequence: 1,
    }
    const events: BoutEventRecord[] = [
      {
        id: 'evt-1',
        boutId: 'bout-1',
        clientEventId: 'period-0',
        sequence: 0,
        eventType: 'PERIOD_ENDED',
        entryId: null,
        cornerAtEvent: null,
        points: null,
        episodeId: null,
        boutElapsedMs: 180_000,
        period: 'main',
        attemptNumber: 1,
        payload: { period: 'main', endedAt: '2026-09-30T10:03:00.000Z' },
        undoneAt: null,
        createdAt: new Date('2026-09-30T10:03:00.000Z'),
      },
    ]

    const result = expirePeriod({
      execution: endedExecution,
      events,
      participants,
      period: 'main',
      periodDurationMs: 180_000,
      now: new Date('2026-09-30T10:04:00.000Z'),
    })

    expect(result.createdEvents).toHaveLength(0)
  })
})
