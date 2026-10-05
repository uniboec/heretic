import { describe, expect, it } from 'vitest'
import {
  computeLiveAuxiliaryTimers,
  computeLivePeriodRemainingMs,
  matTimersNeedLiveTick,
} from '../liveMatTimers'

describe('computeLivePeriodRemainingMs', () => {
  it('counts down from server snapshot while clock is running', () => {
    const anchoredAtMs = new Date('2026-09-30T10:01:30.000Z').getTime()
    const nowMs = new Date('2026-09-30T10:02:00.000Z').getTime()

    expect(
      computeLivePeriodRemainingMs({
        clockState: 'running',
        clockStartedAt: '2026-09-30T10:00:00.000Z',
        clockElapsedBeforeStartMs: 0,
        periodDurationMs: 180_000,
        periodDeadlineAt: '2026-09-30T10:03:00.000Z',
        snapshotRemainingMs: 90_000,
        snapshotAnchoredAtMs: anchoredAtMs,
        nowMs,
      }),
    ).toBe(60_000)
  })

  it('ignores client clock skew when anchored to server snapshot', () => {
    const anchoredAtMs = 1_000_000
    const snapshotRemainingMs = 180_000

    expect(
      computeLivePeriodRemainingMs({
        clockState: 'running',
        clockStartedAt: '2026-09-30T10:00:00.000Z',
        clockElapsedBeforeStartMs: 0,
        periodDurationMs: 180_000,
        periodDeadlineAt: '2026-09-30T10:03:33.000Z',
        snapshotRemainingMs,
        snapshotAnchoredAtMs: anchoredAtMs,
        nowMs: anchoredAtMs + 2_000,
      }),
    ).toBe(178_000)
  })

  it('keeps snapshot value while clock is stopped', () => {
    expect(
      computeLivePeriodRemainingMs({
        clockState: 'stopped',
        clockStartedAt: null,
        clockElapsedBeforeStartMs: 42_000,
        periodDurationMs: 180_000,
        periodDeadlineAt: null,
        snapshotRemainingMs: 138_000,
        snapshotAnchoredAtMs: Date.now(),
        nowMs: Date.now(),
      }),
    ).toBe(138_000)
  })
})

describe('computeLiveAuxiliaryTimers', () => {
  it('updates secondary call remaining time from deadlineAt', () => {
    const deadlineAt = '2026-09-30T10:02:00.000Z'
    const nowMs = new Date('2026-09-30T10:01:40.000Z').getTime()

    const timers = computeLiveAuxiliaryTimers(
      {
        secondaryCalls: {
          red: {
            entryId: 'red-1',
            startedAt: '2026-09-30T10:00:00.000Z',
            deadlineAt,
            remainingMs: 0,
          },
        },
      },
      nowMs,
    )

    expect(timers.secondaryCalls?.red?.remainingMs).toBe(20_000)
  })
})

describe('computeLiveAuxiliaryTimers passivity', () => {
  it('keeps passivity elapsed frozen while fight clock is stopped', () => {
    const nowMs = new Date('2026-09-30T10:05:00.000Z').getTime()

    const timers = computeLiveAuxiliaryTimers(
      {
        passivity: {
          startedAt: '2026-09-30T10:00:00.000Z',
          startBoutElapsedMs: 0,
          entryId: 'red-1',
          corner: 'red',
          elapsedMs: 8_000,
          penaltiesApplied: 0,
          nextPenaltyInMs: 12_000,
          nextSanction: 'WARNING_1',
          disqualificationDue: false,
        },
      },
      nowMs,
      {
        clockState: 'stopped',
        clockStartedAt: null,
        clockElapsedBeforeStartMs: 8_000,
      },
    )

    expect(timers.passivity?.elapsedMs).toBe(8_000)
  })

  it('ticks passivity elapsed from bout clock while fight clock is running', () => {
    const startedAt = '2026-09-30T10:00:00.000Z'
    const nowMs = new Date('2026-09-30T10:00:12.000Z').getTime()

    const timers = computeLiveAuxiliaryTimers(
      {
        passivity: {
          startedAt,
          startBoutElapsedMs: 0,
          entryId: 'red-1',
          corner: 'red',
          elapsedMs: 0,
          penaltiesApplied: 0,
          nextPenaltyInMs: 20_000,
          nextSanction: 'WARNING_1',
          disqualificationDue: false,
        },
      },
      nowMs,
      {
        clockState: 'running',
        clockStartedAt: new Date(startedAt),
        clockElapsedBeforeStartMs: 0,
      },
    )

    expect(timers.passivity?.elapsedMs).toBe(12_000)
  })
})

describe('matTimersNeedLiveTick', () => {
  it('ticks while fight clock is running', () => {
    expect(
      matTimersNeedLiveTick({
        clockState: 'running',
        auxiliaryTimers: {},
      }),
    ).toBe(true)
  })

  it('ticks while athlete doctor visit is active', () => {
    expect(
      matTimersNeedLiveTick({
        clockState: 'stopped',
        auxiliaryTimers: {
          athleteDoctorVisits: {
            red: {
              entryId: 'red-1',
              accumulatedMs: 0,
              startedAt: '2026-09-30T10:00:00.000Z',
              isActive: true,
              totalMs: 0,
              removalAvailable: false,
            },
          },
        },
      }),
    ).toBe(true)
  })

  it('ticks while athlete wait is active', () => {
    expect(
      matTimersNeedLiveTick({
        clockState: 'idle',
        auxiliaryTimers: {
          athleteWaits: {
            red: {
              entryId: 'red-1',
              accumulatedMs: 0,
              startedAt: '2026-09-30T10:00:00.000Z',
              isActive: true,
              totalMs: 0,
              noShowAvailable: false,
            },
          },
        },
      }),
    ).toBe(true)
  })
})

describe('computeLiveAuxiliaryTimers athlete wait', () => {
  it('increments total wait time from startedAt', () => {
    const startedAt = '2026-09-30T10:00:00.000Z'
    const nowMs = new Date('2026-09-30T10:00:08.000Z').getTime()

    const timers = computeLiveAuxiliaryTimers(
      {
        athleteWaits: {
          blue: {
            entryId: 'blue-1',
            accumulatedMs: 15_000,
            startedAt,
            isActive: true,
            totalMs: 15_000,
            noShowAvailable: false,
          },
        },
      },
      nowMs,
    )

    expect(timers.athleteWaits?.blue?.totalMs).toBe(23_000)
  })

  it('increments red corner wait time from startedAt', () => {
    const startedAt = '2026-09-30T10:00:00.000Z'
    const nowMs = new Date('2026-09-30T10:00:05.000Z').getTime()

    const timers = computeLiveAuxiliaryTimers(
      {
        athleteWaits: {
          red: {
            entryId: 'red-1',
            accumulatedMs: 0,
            startedAt,
            isActive: true,
            totalMs: 0,
            noShowAvailable: false,
          },
        },
      },
      nowMs,
    )

    expect(timers.athleteWaits?.red?.totalMs).toBe(5_000)
  })
})

describe('computeLiveAuxiliaryTimers athlete doctor', () => {
  it('increments total doctor time from startedAt', () => {
    const startedAt = '2026-09-30T10:00:00.000Z'
    const nowMs = new Date('2026-09-30T10:00:08.000Z').getTime()

    const timers = computeLiveAuxiliaryTimers(
      {
        athleteDoctorVisits: {
          red: {
            entryId: 'red-1',
            accumulatedMs: 15_000,
            startedAt,
            isActive: true,
            totalMs: 15_000,
            removalAvailable: false,
          },
        },
      },
      nowMs,
    )

    expect(timers.athleteDoctorVisits?.red?.totalMs).toBe(23_000)
    expect(timers.athleteDoctorVisits?.red?.removalAvailable).toBe(false)
  })
})

describe('computeLiveAuxiliaryTimers athlete equipment', () => {
  it('increments total equipment time from startedAt', () => {
    const startedAt = '2026-09-30T10:00:00.000Z'
    const nowMs = new Date('2026-09-30T10:00:08.000Z').getTime()

    const timers = computeLiveAuxiliaryTimers(
      {
        athleteEquipmentCorrections: {
          red: {
            entryId: 'red-1',
            accumulatedMs: 15_000,
            startedAt,
            isActive: true,
            totalMs: 15_000,
            disqualifyAvailable: false,
          },
        },
      },
      nowMs,
    )

    expect(timers.athleteEquipmentCorrections?.red?.totalMs).toBe(23_000)
    expect(timers.athleteEquipmentCorrections?.red?.disqualifyAvailable).toBe(false)
  })
})
