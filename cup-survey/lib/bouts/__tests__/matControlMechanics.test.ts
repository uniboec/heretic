import { describe, expect, it } from 'vitest'
import { ActiveBoutConflictError } from '../mat-control/errors'
import { cancelBoutStoppage } from '../cancelBoutStoppage'
import {
  applySharedEpisodeTie,
  baseExecution,
  defaultParticipants,
  defaultSession,
  runMatControlCommand,
} from './matControlTestHelpers'

function advanceToPendingActivityDecision() {
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

  const fight = runMatControlCommand('CLOCK_START', {}, { execution, session, events })
  execution = fight.execution
  session = fight.session
  events = fight.events

  const mainTie = applySharedEpisodeTie({ execution, session, events }, 2, 2, 'main-tie')
  execution = mainTie.execution
  events = mainTie.events

  const mainExpired = runMatControlCommand(
    'EXPIRE_PERIOD',
    { period: 'main', periodDurationMs: 180_000 },
    {
      execution: { ...execution, clockElapsedBeforeStartMs: 180_000 },
      session,
      events,
      now: new Date('2026-09-30T10:03:30.000Z'),
    },
  )
  execution = mainExpired.execution
  events = mainExpired.events

  const extraStart = runMatControlCommand('CLOCK_START', {}, { execution, session, events })
  execution = extraStart.execution
  session = extraStart.session
  events = extraStart.events

  const extraTie = applySharedEpisodeTie({ execution, session, events }, 2, 2, 'extra-tie')
  execution = extraTie.execution
  events = extraTie.events

  const extraExpired = runMatControlCommand(
    'EXPIRE_PERIOD',
    { period: 'extra', periodDurationMs: 180_000 },
    {
      execution: { ...execution, clockElapsedBeforeStartMs: 180_000 },
      session,
      events,
      now: new Date('2026-09-30T10:07:30.000Z'),
    },
  )

  return {
    execution: extraExpired.execution,
    session: extraExpired.session,
    events: extraExpired.events,
  }
}

describe('mat control mechanics', () => {
  it('pins session active bout on first call and blocks another scheduled bout', () => {
    const first = runMatControlCommand(
      'FIRST_CALL',
      { entryId: 'red-1', corner: 'red' },
      { execution: baseExecution(), session: defaultSession, events: [] },
    )
    expect(first.session.activeBoutId).toBe('bout-1')

    expect(() =>
      runMatControlCommand(
        'FIRST_CALL',
        { entryId: 'red-1', corner: 'red' },
        {
          execution: baseExecution({ boutId: 'bout-2' }),
          session: first.session,
          events: [],
        },
      ),
    ).toThrow(ActiveBoutConflictError)
  })

  it('returns to activity decision after canceling activity-correction stoppage', () => {
    const pending = advanceToPendingActivityDecision()
    expect(pending.execution.boutPhase).toBe('pending_activity_decision')

    const enterCorrection = runMatControlCommand(
      'CORRECT_BEFORE_ACTIVITY',
      { enable: true },
      pending,
    )
    const fixScore = runMatControlCommand(
      'TECHNICAL_SCORE',
      { entryId: 'red-1', corner: 'red', points: 2 },
      {
        execution: enterCorrection.execution,
        session: enterCorrection.session,
        events: enterCorrection.events,
      },
    )
    const finished = runMatControlCommand('FINISH_ACTIVITY_CORRECTION', {}, {
      execution: fixScore.execution,
      session: fixScore.session,
      events: fixScore.events,
    })
    expect(finished.execution.boutPhase).toBe('pending_confirmation')

    const stoppage = finished.createdEvents.find((event) => event.eventType === 'BOUT_STOPPAGE')
    expect((stoppage?.payload as { trigger?: string }).trigger).toBe('ACTIVITY_CORRECTION')

    const cancelled = runMatControlCommand('CANCEL_STOPPAGE', {}, finished)
    expect(cancelled.execution.boutPhase).toBe('pending_activity_decision')
    expect(cancelled.execution.periodCorrectionMode).toBe(false)
    expect(cancelled.response.mode).toBe('ACTIVITY_DECISION_REVERT')
  })

  it('enters period correction after canceling time-expired stoppage on main', () => {
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

    const fight = runMatControlCommand('CLOCK_START', {}, { execution, session, events })
    execution = fight.execution
    session = fight.session
    events = fight.events

    const scored = runMatControlCommand(
      'TECHNICAL_SCORE',
      { entryId: 'red-1', corner: 'red', points: 4 },
      { execution, session, events },
    )
    const expired = runMatControlCommand(
      'EXPIRE_PERIOD',
      { period: 'main', periodDurationMs: 180_000 },
      {
        ...scored,
        execution: {
          ...scored.execution,
          officialStartedAt: new Date('2026-09-30T10:00:00.000Z'),
          clockElapsedBeforeStartMs: 180_000,
        },
        now: new Date('2026-09-30T10:03:30.000Z'),
      },
    )
    expect(expired.execution.boutPhase).toBe('pending_confirmation')

    const cancelled = runMatControlCommand('CANCEL_STOPPAGE', {}, expired)
    expect(cancelled.execution.boutPhase).toBe('live')
    expect(cancelled.execution.periodCorrectionMode).toBe(true)
    expect(cancelled.response.mode).toBe('PERIOD_END_CORRECTION')
  })

  it('rejects undo in pending_confirmation', () => {
    const live = runMatControlCommand('CLOCK_START', {}, {
      execution: baseExecution({ boutPhase: 'live', officialStartedAt: new Date() }),
      session: { ...defaultSession, activeBoutId: 'bout-1' },
      events: [],
    })
    const stopped = runMatControlCommand(
      'STOPPAGE_CLEAR_ADVANTAGE',
      { winnerCorner: 'red' },
      live,
    )

    expect(() =>
      runMatControlCommand('UNDO', {}, {
        execution: stopped.execution,
        session: stopped.session,
        events: stopped.events,
      }),
    ).toThrow()
  })

  it('rejects extra activity decide during activity correction mode', () => {
    const pending = advanceToPendingActivityDecision()
    const correction = runMatControlCommand(
      'CORRECT_BEFORE_ACTIVITY',
      { enable: true },
      pending,
    )

    expect(() =>
      runMatControlCommand('EXTRA_ACTIVITY_DECIDE', { winnerCorner: 'red' }, correction),
    ).toThrow()
  })

  it('reverts clock adjust on undo', () => {
    const live = {
      execution: baseExecution({
        boutPhase: 'live',
        officialStartedAt: new Date(),
        clockState: 'stopped',
        clockElapsedBeforeStartMs: 60_000,
      }),
      session: { ...defaultSession, activeBoutId: 'bout-1' },
      events: [] as typeof import('../mat-control/types').BoutEventRecord[],
    }

    const adjusted = runMatControlCommand(
      'CLOCK_ADJUST',
      { deltaMs: 30_000, periodDurationMs: 180_000 },
      live,
    )
    expect(adjusted.execution.clockElapsedBeforeStartMs).toBe(30_000)

    const undone = runMatControlCommand(
      'UNDO',
      { periodDurationMs: 180_000 },
      adjusted,
    )
    expect(undone.execution.clockElapsedBeforeStartMs).toBe(60_000)
  })

  it('reverts corner swap on undo and restores liveSnapshot parity', () => {
    let execution = baseExecution({ boutPhase: 'live', officialStartedAt: new Date() })
    let events: typeof import('../mat-control/types').BoutEventRecord[] = []
    let session = { ...defaultSession, activeBoutId: 'bout-1' }

    const swapped = runMatControlCommand('CORNER_SWAP', {}, { execution, session, events })
    expect((swapped.execution.liveSnapshot as { cornersSwapped?: boolean }).cornersSwapped).toBe(
      true,
    )

    const undone = runMatControlCommand('UNDO', {}, {
      execution: swapped.execution,
      session: swapped.session,
      events: swapped.events,
    })
    expect((undone.execution.liveSnapshot as { cornersSwapped?: boolean }).cornersSwapped).toBe(
      false,
    )
    expect(undone.events.filter((event) => event.eventType === 'CORNER_SWAP' && !event.undoneAt)).toHaveLength(
      0,
    )
  })

  it('undoes adjudication as a paired score event', () => {
    let execution = baseExecution({ boutPhase: 'live', officialStartedAt: new Date() })
    let events: typeof import('../mat-control/types').BoutEventRecord[] = []
    let session = { ...defaultSession, activeBoutId: 'bout-1' }

    const adjudicated = runMatControlCommand(
      'ADJUDICATION_SCORE',
      { entryId: 'red-1', corner: 'red', points: 2 },
      { execution, session, events },
    )
    expect(adjudicated.events.filter((event) => !event.undoneAt)).toHaveLength(2)

    const undone = runMatControlCommand('UNDO', {}, adjudicated)
    const active = undone.events.filter((event) => !event.undoneAt)
    expect(active.some((event) => event.eventType === 'TECHNICAL_SCORE')).toBe(false)
    expect(active.some((event) => event.eventType === 'ADJUDICATION')).toBe(false)
  })

  it('maps activity correction cancel mode through cancelBoutStoppage helper', () => {
    const result = cancelBoutStoppage({
      execution: baseExecution({
        boutPhase: 'pending_confirmation',
        currentPeriod: 'extra',
        extraEndedAt: new Date('2026-09-30T10:06:00.000Z'),
        officialEndedAt: new Date('2026-09-30T10:06:00.000Z'),
      }),
      session: defaultSession,
      stoppageEvent: {
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
        period: 'extra',
        attemptNumber: 1,
        payload: { trigger: 'ACTIVITY_CORRECTION' },
        undoneAt: null,
        createdAt: new Date(),
      },
      now: new Date(),
    })

    expect(result.mode).toBe('ACTIVITY_DECISION_REVERT')
    expect(result.execution.boutPhase).toBe('pending_activity_decision')
  })
})
