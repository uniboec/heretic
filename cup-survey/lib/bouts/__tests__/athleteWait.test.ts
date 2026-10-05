import { describe, expect, it } from 'vitest'
import {
  assertAthleteWaitPause,
  assertAthleteWaitStart,
  buildLateAppearancePenaltyPayloads,
  computeAthleteWaitTimers,
  countLateAppearancePenaltiesInEpisode,
  hasActiveAthleteWaitForEntry,
  resolveAthleteWaitState,
} from '../athleteWait'
import {
  AthleteWaitAlreadyActiveError,
  AthleteWaitNotActiveError,
} from '../mat-control/errors'
import type { BoutEventRecord } from '../mat-control/types'

function waitEvent(
  eventType: 'ATHLETE_WAIT_START' | 'ATHLETE_WAIT_END',
  input: {
    entryId: string
    corner: 'red' | 'blue'
    createdAt: Date
    accumulatedMs?: number
    sessionMs?: number
    penaltyStepsApplied?: number
    attemptNumber?: number
  },
): BoutEventRecord {
  const payload =
    eventType === 'ATHLETE_WAIT_START'
      ? { accumulatedMs: input.accumulatedMs ?? 0 }
      : {
          accumulatedMs: input.accumulatedMs ?? 0,
          sessionMs: input.sessionMs ?? 0,
          penaltyStepsApplied: input.penaltyStepsApplied ?? 0,
        }

  return {
    id: `${eventType}-${input.createdAt.getTime()}`,
    boutId: 'bout-1',
    clientEventId: `${eventType}-${input.createdAt.getTime()}`,
    sequence: 1,
    eventType,
    entryId: input.entryId,
    cornerAtEvent: input.corner,
    points: null,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: input.attemptNumber ?? 1,
    payload,
    undoneAt: null,
    createdAt: input.createdAt,
  }
}

describe('athleteWait', () => {
  const entryId = 'red-1'
  const t0 = new Date('2026-01-01T12:00:00.000Z')
  const t15 = new Date('2026-01-01T12:00:15.000Z')
  const t20 = new Date('2026-01-01T12:00:20.000Z')
  const t35 = new Date('2026-01-01T12:00:35.000Z')

  it('accumulates paused wait time across resume cycles', () => {
    const events = [
      waitEvent('ATHLETE_WAIT_START', { entryId, corner: 'red', createdAt: t0, accumulatedMs: 0 }),
      waitEvent('ATHLETE_WAIT_END', {
        entryId,
        corner: 'red',
        createdAt: t15,
        accumulatedMs: 15_000,
        sessionMs: 15_000,
      }),
      waitEvent('ATHLETE_WAIT_START', {
        entryId,
        corner: 'red',
        createdAt: t20,
        accumulatedMs: 15_000,
      }),
    ]

    const paused = resolveAthleteWaitState({ events, entryId, now: t20 })
    expect(paused?.isActive).toBe(true)
    expect(paused?.accumulatedMs).toBe(15_000)
    expect(paused?.totalMs).toBe(15_000)

    const resumed = resolveAthleteWaitState({ events, entryId, now: t35 })
    expect(resumed?.isActive).toBe(true)
    expect(resumed?.totalMs).toBe(30_000)

    expect(() => assertAthleteWaitStart({ entryId, events, attemptNumber: 1 })).toThrow(
      AthleteWaitAlreadyActiveError,
    )
    assertAthleteWaitPause({ entryId, events, attemptNumber: 1 })
  })

  it('shows paused total after stop without active session', () => {
    const events = [
      waitEvent('ATHLETE_WAIT_START', { entryId, corner: 'red', createdAt: t0, accumulatedMs: 0 }),
      waitEvent('ATHLETE_WAIT_END', {
        entryId,
        corner: 'red',
        createdAt: t15,
        accumulatedMs: 15_000,
        sessionMs: 15_000,
      }),
    ]

    const paused = resolveAthleteWaitState({ events, entryId, now: t35 })
    expect(paused?.isActive).toBe(false)
    expect(paused?.totalMs).toBe(15_000)
    expect(() => assertAthleteWaitPause({ entryId, events, attemptNumber: 1 })).toThrow(
      AthleteWaitNotActiveError,
    )
    assertAthleteWaitStart({ entryId, events, attemptNumber: 1 })
  })

  it('ignores open wait episodes from previous attempts when checking guards', () => {
    const events = [
      waitEvent('ATHLETE_WAIT_START', {
        entryId,
        corner: 'red',
        createdAt: t0,
        accumulatedMs: 0,
        attemptNumber: 2,
      }),
    ]

    expect(() => assertAthleteWaitStart({ entryId, events, attemptNumber: 11 })).not.toThrow()
    expect(hasActiveAthleteWaitForEntry(events, entryId, 11)).toBe(false)
    expect(hasActiveAthleteWaitForEntry(events, entryId, 2)).toBe(true)
  })

  it('keeps wait on the UI corner from cornerAtEvent when corners are swapped', () => {
    const participants = {
      redEntryId: 'side-a',
      blueEntryId: 'side-b',
      cornersSwapped: true,
    }
    const events = [
      waitEvent('ATHLETE_WAIT_START', {
        entryId: 'side-a',
        corner: 'red',
        createdAt: t0,
        accumulatedMs: 0,
      }),
    ]

    const timers = computeAthleteWaitTimers({
      events,
      participants,
      attemptNumber: 1,
      now: t15,
    })

    expect(timers.red?.isActive).toBe(true)
    expect(timers.red?.totalMs).toBe(15_000)
    expect(timers.blue).toBeUndefined()
  })

  it('maps active wait to UI corner when corners are swapped', () => {
    const participants = {
      redEntryId: 'side-a',
      blueEntryId: 'side-b',
      cornersSwapped: true,
    }
    const events = [
      waitEvent('ATHLETE_WAIT_START', {
        entryId: 'side-b',
        corner: 'red',
        createdAt: t0,
        accumulatedMs: 0,
      }),
    ]

    const timers = computeAthleteWaitTimers({
      events,
      participants,
      attemptNumber: 1,
      now: t15,
    })

    expect(timers.red?.isActive).toBe(true)
    expect(timers.red?.totalMs).toBe(15_000)
    expect(timers.blue).toBeUndefined()
  })

  it('counts late-appearance penalties from active penalty events, not wait-end payload', () => {
    const events = [
      waitEvent('ATHLETE_WAIT_START', {
        entryId: 'red-1',
        corner: 'red',
        createdAt: t0,
      }),
      waitEvent('ATHLETE_WAIT_END', {
        entryId: 'red-1',
        corner: 'red',
        createdAt: t15,
        accumulatedMs: 125_000,
        penaltyStepsApplied: 2,
      }),
      {
        ...waitEvent('ATHLETE_WAIT_START', {
          entryId: 'red-1',
          corner: 'red',
          createdAt: t15,
        }),
        id: 'penalty-1',
        eventType: 'PENALTY',
        payload: { ladder: 'GENERAL', sanction: 'WARNING_1' },
        points: 0,
        undoneAt: new Date('2026-09-30T10:01:00.000Z'),
      },
    ]

    expect(
      countLateAppearancePenaltiesInEpisode({
        events,
        entryId: 'red-1',
        attemptNumber: 1,
      }),
    ).toBe(0)
  })

  it('builds late-appearance penalties from waited duration', () => {
    const payloads = buildLateAppearancePenaltyPayloads({
      events: [],
      corner: 'red',
      period: 'main',
      attemptNumber: 1,
      waitedMs: 125_000,
      stepsToApply: 2,
    })

    expect(payloads).toHaveLength(2)
    expect(payloads[0]?.sanction).toBe('WARNING_1')
    expect(payloads[1]?.sanction).toBe('WARNING_2')
  })
})
