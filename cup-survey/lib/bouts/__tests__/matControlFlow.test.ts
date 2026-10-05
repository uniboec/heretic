import { describe, expect, it } from 'vitest'
import { routeMatControlCommand } from '../matControlCommandRouter'
import { reduceScoreEvents } from '../scoreEngine'
import type {
  BoutEventRecord,
  BoutMutationEnvelope,
  MatControlExecution,
  MatControlSessionRecord,
} from '../mat-control/types'

const participants = {
  redEntryId: 'red-1',
  blueEntryId: 'blue-1',
  cornersSwapped: false,
}

const envelope: BoutMutationEnvelope = {
  operationId: 'op-1',
  holderToken: 'token',
  expectedLiveRevision: 0,
  expectedAttemptNumber: 1,
}

const session: MatControlSessionRecord = {
  tournamentScopeId: 'cup-2026',
  matIndex: 1,
  activeBoutId: null,
  correctionFocusBoutId: null,
  revision: 0,
  holderToken: 'token',
  holderSince: new Date(),
  heartbeatAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
}

function baseExecution(): MatControlExecution {
  return {
    id: 'exec-1',
    boutId: 'bout-1',
    tournamentScopeId: 'cup-2026',
    actualStartAt: null,
    actualEndAt: null,
    officialStartedAt: null,
    officialEndedAt: null,
    mainEndedAt: null,
    extraEndedAt: null,
    activityCorrectionMode: false,
    periodCorrectionMode: false,
    attemptNumber: 1,
    boutPhase: 'scheduled',
    clockState: 'idle',
    clockStartedAt: null,
    clockElapsedBeforeStartMs: 0,
    currentPeriod: 'main',
    nextEventSequence: 0,
    liveRevision: 0,
    liveSnapshot: null,
  }
}

function run(
  intent: Parameters<typeof routeMatControlCommand>[0]['intent'],
  payload: Record<string, unknown>,
  state: {
    execution: MatControlExecution
    session: MatControlSessionRecord
    events: BoutEventRecord[]
  },
) {
  const now = new Date('2026-09-30T10:00:00.000Z')
  const result = routeMatControlCommand({
    execution: state.execution,
    session: state.session,
    participants,
    events: state.events,
    now,
    envelope: {
      ...envelope,
      expectedLiveRevision: state.execution.liveRevision,
      expectedAttemptNumber: state.execution.attemptNumber,
    },
    intent,
    payload,
  })

  return {
    execution: result.execution,
    session: result.session,
    events: [...state.events, ...result.createdEvents],
    createdEvents: result.createdEvents,
  }
}

describe('matControl TC/CC flow', () => {
  it('runs pre-fight calls, live scoring, and stoppage', () => {
    let execution = baseExecution()
    let events: BoutEventRecord[] = []
    let activeSession = session

    const firstRed = run('FIRST_CALL', { entryId: 'red-1', corner: 'red' }, {
      execution,
      session: activeSession,
      events,
    })
    execution = firstRed.execution
    events = firstRed.events

    const firstBlue = run('FIRST_CALL', { entryId: 'blue-1', corner: 'blue' }, {
      execution,
      session: activeSession,
      events,
    })
    execution = firstBlue.execution
    events = firstBlue.events

    const fight = run('CLOCK_START', {}, { execution, session: activeSession, events })
    execution = fight.execution
    activeSession = fight.session
    events = fight.events
    expect(execution.boutPhase).toBe('live')

    const score = run(
      'TECHNICAL_SCORE',
      { entryId: 'red-1', corner: 'red', points: 4, adminOverrideReason: 'test setup' },
      { execution, session: activeSession, events },
    )
    execution = score.execution
    events = score.events

    const stoppage = run(
      'STOPPAGE_CLEAR_ADVANTAGE',
      { winnerCorner: 'red' },
      { execution, session: activeSession, events },
    )
    execution = stoppage.execution
    events = stoppage.events

    expect(execution.boutPhase).toBe('pending_confirmation')
    expect(events.some((event) => event.eventType === 'FIRST_CALL')).toBe(true)
    expect(events.some((event) => event.eventType === 'TECHNICAL_SCORE')).toBe(true)
    expect(events.some((event) => event.eventType === 'BOUT_STOPPAGE')).toBe(true)

    const confirmed = run('CONFIRM', {}, {
      execution,
      session: activeSession,
      events,
    })
    execution = confirmed.execution
    activeSession = confirmed.session

    expect(execution.boutPhase).toBe('confirmed')
    expect(activeSession.activeBoutId).toBe('bout-1')

    const opened = run('OPEN_NEXT_BOUT', {}, {
      execution,
      session: activeSession,
      events,
    })
    expect(opened.session.activeBoutId).toBeNull()
  })

  it('replays EXPIRE_PERIOD without stale revision when period already ended', () => {
    const execution = {
      ...baseExecution(),
      boutPhase: 'live' as const,
      liveRevision: 3,
      mainEndedAt: new Date('2026-09-30T10:03:00.000Z'),
      currentPeriod: 'extra' as const,
    }

    const result = routeMatControlCommand({
      execution,
      session: { ...session, activeBoutId: 'bout-1' },
      participants,
      events: [],
      now: new Date('2026-09-30T10:04:00.000Z'),
      envelope: {
        ...envelope,
        operationId: 'op-expire-replay',
        expectedLiveRevision: 0,
        expectedAttemptNumber: 1,
      },
      intent: 'EXPIRE_PERIOD',
      payload: { period: 'main', periodDurationMs: 180_000 },
    })

    expect(result.response.alreadyProcessed).toBe(true)
    expect(result.response.liveRevision).toBe(3)
    expect(result.createdEvents).toHaveLength(0)
  })

  it('RESET_BOUT starts a new attempt with zero score', () => {
    let execution = baseExecution()
    let events: BoutEventRecord[] = []
    let activeSession = { ...session, activeBoutId: 'bout-1' }

    const fight = run('CLOCK_START', {}, { execution, session: activeSession, events })
    execution = fight.execution
    activeSession = fight.session
    events = fight.events

    const score = run(
      'TECHNICAL_SCORE',
      { entryId: 'red-1', corner: 'red', points: 4, adminOverrideReason: 'test setup' },
      { execution, session: activeSession, events },
    )
    execution = score.execution
    events = score.events

    expect(
      reduceScoreEvents(events, 'main', execution.attemptNumber).officialScore,
    ).toEqual({ red: 4, blue: 0 })

    const reset = run('RESET_BOUT', {}, { execution, session: activeSession, events })
    execution = reset.execution
    events = reset.events

    expect(execution.attemptNumber).toBe(2)
    expect(execution.boutPhase).toBe('scheduled')
    expect(execution.clockElapsedBeforeStartMs).toBe(0)
    expect(
      reduceScoreEvents(events, 'main', execution.attemptNumber).officialScore,
    ).toEqual({ red: 0, blue: 0 })
    expect(events.filter((event) => event.attemptNumber === 1)).toHaveLength(2)
  })

  it('records bout elapsed time across pause and resume when scoring', () => {
    const t0 = new Date('2026-09-30T10:00:00.000Z')
    const t20 = new Date('2026-09-30T10:00:20.000Z')
    const t30 = new Date('2026-09-30T10:00:30.000Z')
    const t45 = new Date('2026-09-30T10:00:45.000Z')

    let execution = baseExecution()
    let events: BoutEventRecord[] = []
    let activeSession = { ...session, activeBoutId: 'bout-1' }

    function routeAt(
      intent: Parameters<typeof routeMatControlCommand>[0]['intent'],
      payload: Record<string, unknown>,
      now: Date,
    ) {
      const result = routeMatControlCommand({
        execution,
        session: activeSession,
        participants,
        events,
        now,
        envelope: {
          ...envelope,
          expectedLiveRevision: execution.liveRevision,
          expectedAttemptNumber: execution.attemptNumber,
        },
        intent,
        payload,
      })
      execution = result.execution
      activeSession = result.session
      events = [...events, ...result.createdEvents]
      return result
    }

    routeAt('CLOCK_START', {}, t0)
    routeAt(
      'TECHNICAL_SCORE',
      { entryId: 'red-1', corner: 'red', points: 1, adminOverrideReason: 'test setup' },
      t0,
    )
    routeAt('CLOCK_STOP', {}, t20)
    routeAt('CLOCK_START', {}, t30)
    routeAt('TECHNICAL_SCORE', { entryId: 'blue-1', corner: 'blue', points: 2 }, t45)

    const scores = events.filter((event) => event.eventType === 'TECHNICAL_SCORE')
    expect(scores[0]?.boutElapsedMs).toBe(0)
    expect(scores[1]?.boutElapsedMs).toBe(35_000)
  })
})
