import { describe, expect, it } from 'vitest'
import { applyBoutTimingSettings } from '../applyBoutTimingSettings'
import {
  baseExecution,
  defaultParticipants,
  defaultSession,
  runMatControlCommand,
} from './matControlTestHelpers'
import { applySharedEpisodeTie } from './matControlTestHelpers'

describe('bout timing settings', () => {
  it('stores per-bout duration overrides in liveSnapshot', () => {
    const result = runMatControlCommand(
      'SET_BOUT_TIMING',
      { mainDurationMs: 120_000, extraDurationMs: 90_000, periodCount: 2 },
      { execution: baseExecution(), session: defaultSession, events: [] },
    )

    const snapshot = result.execution.liveSnapshot as {
      periodDurationMs?: { main?: number; extra?: number }
      periodCount?: number
    }
    expect(snapshot.periodDurationMs?.main).toBe(120_000)
    expect(snapshot.periodDurationMs?.extra).toBe(90_000)
    expect(snapshot.periodCount).toBe(2)
  })

  it('skips extra round when periodCount is 1 and main ends in a tie', () => {
    let execution = baseExecution()
    let events: typeof import('../mat-control/types').BoutEventRecord[] = []
    let session = defaultSession

    for (const corner of ['red', 'blue'] as const) {
      const call = runMatControlCommand(
        'FIRST_CALL',
        { entryId: corner === 'red' ? 'red-1' : 'blue-1', corner },
        { execution, session, events },
      )
      execution = call.execution
      events = call.events
    }

    const timing = runMatControlCommand(
      'SET_BOUT_TIMING',
      { mainDurationMs: 180_000, periodCount: 1 },
      { execution, session, events },
    )
    execution = timing.execution

    const fight = runMatControlCommand('CLOCK_START', {}, { execution, session, events })
    execution = fight.execution
    session = fight.session
    events = fight.events

    const tie = applySharedEpisodeTie({ execution, session, events }, 2, 2, 'main-tie')
    execution = tie.execution
    events = tie.events

    const expired = runMatControlCommand(
      'EXPIRE_PERIOD',
      { period: 'main', periodDurationMs: 180_000 },
      {
        execution: { ...execution, clockElapsedBeforeStartMs: 180_000 },
        session,
        events,
        now: new Date('2026-09-30T10:03:30.000Z'),
      },
    )

    expect(expired.execution.boutPhase).toBe('pending_activity_decision')
    expect(expired.execution.currentPeriod).toBe('main')
  })

  it('clamps elapsed time when duration is reduced', () => {
    const execution = applyBoutTimingSettings({
      execution: {
        ...baseExecution(),
        boutPhase: 'live',
        clockState: 'stopped',
        clockElapsedBeforeStartMs: 150_000,
      },
      payload: { mainDurationMs: 120_000 },
      now: new Date('2026-09-30T10:01:30.000Z'),
    })

    expect(execution.clockElapsedBeforeStartMs).toBe(120_000)
  })
})
