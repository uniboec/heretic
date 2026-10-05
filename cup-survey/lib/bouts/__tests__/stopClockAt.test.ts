import { describe, expect, it } from 'vitest'
import {
  adjustClockElapsed,
  computeClockElapsedMs,
  computePeriodDeadlineAt,
  computeRemainingMs,
  revertUndoneClockAdjusts,
  startClockAt,
  stopClockAt,
} from '../stopClockAt'
import type { MatControlExecution } from '../mat-control/types'

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

describe('stopClockAt helpers', () => {
  it('clamps CLOCK_ADJUST elapsed between 0 and period duration', () => {
    const adjusted = adjustClockElapsed(baseExecution, -90_000, 180_000)
    expect(adjusted.clockElapsedBeforeStartMs).toBe(90_000)

    const maxed = adjustClockElapsed(baseExecution, -300_000, 180_000)
    expect(maxed.clockElapsedBeforeStartMs).toBe(180_000)
  })

  it('accepts ISO string clockStartedAt from JSON snapshots', () => {
    const elapsed = computeClockElapsedMs(
      {
        clockState: 'running',
        clockStartedAt: '2026-09-30T10:00:00.000Z',
        clockElapsedBeforeStartMs: 5_000,
      },
      new Date('2026-09-30T10:00:10.000Z'),
    )
    expect(elapsed).toBe(15_000)
  })

  it('computes periodDeadlineAt only while clock is running', () => {
    const runningDeadline = computePeriodDeadlineAt(baseExecution, 180_000)
    expect(runningDeadline?.toISOString()).toBe('2026-09-30T10:03:00.000Z')

    const stopped = stopClockAt(baseExecution, new Date('2026-09-30T10:01:00.000Z'))
    expect(computePeriodDeadlineAt(stopped, 180_000)).toBeNull()
  })

  it('pauses clock without inflating remaining time', () => {
    const paused = stopClockAt(baseExecution, new Date('2026-09-30T10:00:30.000Z'))
    expect(paused.clockElapsedBeforeStartMs).toBe(30_000)
    expect(
      computeRemainingMs(paused, 180_000, new Date('2026-09-30T10:01:00.000Z')),
    ).toBe(150_000)
  })

  it('resumes clock from stored elapsed time', () => {
    const paused = stopClockAt(baseExecution, new Date('2026-09-30T10:00:30.000Z'))
    const resumed = startClockAt(paused, new Date('2026-09-30T10:01:00.000Z'))
    expect(
      computeRemainingMs(resumed, 180_000, new Date('2026-09-30T10:01:30.000Z')),
    ).toBe(120_000)
  })

  it('reverts undone CLOCK_ADJUST events', () => {
    const adjusted = adjustClockElapsed(baseExecution, 30_000, 180_000)
    expect(adjusted.clockElapsedBeforeStartMs).toBe(0)

    const reverted = revertUndoneClockAdjusts({
      execution: adjusted,
      undoneTargets: [
        {
          id: 'clock-1',
          boutId: 'bout-1',
          clientEventId: 'clock-1',
          sequence: 1,
          eventType: 'CLOCK_ADJUST',
          entryId: null,
          cornerAtEvent: null,
          points: null,
          episodeId: null,
          boutElapsedMs: 0,
          period: 'main',
          attemptNumber: 1,
          payload: { deltaMs: 30_000 },
          undoneAt: new Date(),
          createdAt: new Date(),
        },
      ],
      periodDurationMs: 180_000,
    })

    expect(reverted.clockElapsedBeforeStartMs).toBe(30_000)
  })

  it('computeClockElapsedMs includes the active running segment', () => {
    const paused = stopClockAt(baseExecution, new Date('2026-09-30T10:00:20.000Z'))
    expect(computeClockElapsedMs(paused, new Date('2026-09-30T10:00:45.000Z'))).toBe(20_000)

    const resumed = startClockAt(paused, new Date('2026-09-30T10:00:30.000Z'))
    expect(computeClockElapsedMs(resumed, new Date('2026-09-30T10:00:45.000Z'))).toBe(35_000)
  })
})
