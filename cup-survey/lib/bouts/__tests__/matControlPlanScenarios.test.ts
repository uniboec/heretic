import { describe, expect, it } from 'vitest'
import { StaleLiveRevisionError } from '../mat-control/errors'
import { routeMatControlCommand } from '../matControlCommandRouter'
import {
  baseExecution,
  defaultParticipants,
  defaultSession,
  applySharedEpisodeTie,
  runMatControlCommand,
} from './matControlTestHelpers'

describe('mat control plan scenarios', () => {
  it('rejects undo in pending_confirmation', () => {
    expect(() =>
      runMatControlCommand(
        'UNDO',
        {},
        {
          execution: baseExecution({ boutPhase: 'pending_confirmation', liveRevision: 2 }),
          session: { ...defaultSession, activeBoutId: 'bout-1' },
          events: [],
        },
      ),
    ).toThrow()
  })

  it('rejects stale live revision', () => {
    expect(() =>
      routeMatControlCommand({
        execution: baseExecution({ boutPhase: 'live', liveRevision: 3 }),
        session: { ...defaultSession, activeBoutId: 'bout-1' },
        participants: defaultParticipants,
        events: [],
        now: new Date(),
        envelope: {
          operationId: 'op-stale',
          holderToken: 'token',
          expectedLiveRevision: 1,
          expectedAttemptNumber: 1,
        },
        intent: 'TECHNICAL_SCORE',
        payload: { entryId: 'red-1', corner: 'red', points: 1 },
      }),
    ).toThrow(StaleLiveRevisionError)
  })

  it('runs tie at main time into extra and confirms winner after extra score', () => {
    let execution = baseExecution()
    let events: typeof import('../mat-control/types').BoutEventRecord[] = []
    let activeSession = defaultSession

    for (const corner of ['red', 'blue'] as const) {
      const call = runMatControlCommand(
        'FIRST_CALL',
        { entryId: corner === 'red' ? 'red-1' : 'blue-1', corner },
        { execution, session: activeSession, events },
      )
      execution = call.execution
      events = call.events
    }

    const fight = runMatControlCommand('CLOCK_START', {}, { execution, session: activeSession, events })
    execution = fight.execution
    activeSession = fight.session
    events = fight.events

    const tiedScore = applySharedEpisodeTie(
      { execution, session: activeSession, events },
      2,
      2,
      'main-tie',
    )
    execution = tiedScore.execution
    events = tiedScore.events

    const expired = runMatControlCommand(
      'EXPIRE_PERIOD',
      { period: 'main', periodDurationMs: 180_000 },
      {
        execution: {
          ...execution,
          officialStartedAt: new Date('2026-09-30T10:00:00.000Z'),
          clockStartedAt: new Date('2026-09-30T10:00:00.000Z'),
          clockElapsedBeforeStartMs: 180_000,
        },
        session: activeSession,
        events,
        now: new Date('2026-09-30T10:03:30.000Z'),
      },
    )
    execution = expired.execution
    events = expired.events
    expect(execution.currentPeriod).toBe('extra')

    const extraWinner = runMatControlCommand(
      'TECHNICAL_SCORE',
      { entryId: 'red-1', corner: 'red', points: 1 },
      { execution, session: activeSession, events },
    )
    execution = extraWinner.execution
    events = extraWinner.events

    const extraExpired = runMatControlCommand(
      'EXPIRE_PERIOD',
      { period: 'extra', periodDurationMs: 180_000 },
      {
        execution: {
          ...execution,
          clockStartedAt: new Date('2026-09-30T10:04:00.000Z'),
          clockElapsedBeforeStartMs: 180_000,
        },
        session: activeSession,
        events,
        now: new Date('2026-09-30T10:07:30.000Z'),
      },
    )
    execution = extraExpired.execution
    events = extraExpired.events
    expect(execution.boutPhase).toBe('pending_confirmation')

    const confirmed = runMatControlCommand('CONFIRM', {}, {
      execution,
      session: activeSession,
      events,
    })
    expect(confirmed.execution.boutPhase).toBe('confirmed')
    expect(confirmed.session.activeBoutId).toBe('bout-1')
  })

  it('corrects extra score before activity decision and confirms without deciding', () => {
    let execution = baseExecution()
    let events: typeof import('../mat-control/types').BoutEventRecord[] = []
    let activeSession = defaultSession

    for (const corner of ['red', 'blue'] as const) {
      const call = runMatControlCommand(
        'FIRST_CALL',
        { entryId: corner === 'red' ? 'red-1' : 'blue-1', corner },
        { execution, session: activeSession, events },
      )
      execution = call.execution
      events = call.events
    }

    const fight = runMatControlCommand('CLOCK_START', {}, { execution, session: activeSession, events })
    execution = fight.execution
    activeSession = fight.session
    events = fight.events

    const mainTie = applySharedEpisodeTie(
      { execution, session: activeSession, events },
      2,
      2,
      'main-tie',
    )
    execution = mainTie.execution
    events = mainTie.events

    const mainExpired = runMatControlCommand(
      'EXPIRE_PERIOD',
      { period: 'main', periodDurationMs: 180_000 },
      {
        execution: {
          ...execution,
          clockElapsedBeforeStartMs: 180_000,
        },
        session: activeSession,
        events,
        now: new Date('2026-09-30T10:03:30.000Z'),
      },
    )
    execution = mainExpired.execution
    events = mainExpired.events
    expect(execution.currentPeriod).toBe('extra')

    const extraStart = runMatControlCommand('CLOCK_START', {}, { execution, session: activeSession, events })
    execution = extraStart.execution
    activeSession = extraStart.session
    events = extraStart.events

    const extraTie = applySharedEpisodeTie(
      { execution, session: activeSession, events },
      2,
      2,
      'extra-tie',
    )
    execution = extraTie.execution
    events = extraTie.events

    const extraExpired = runMatControlCommand(
      'EXPIRE_PERIOD',
      { period: 'extra', periodDurationMs: 180_000 },
      {
        execution: {
          ...execution,
          clockElapsedBeforeStartMs: 180_000,
        },
        session: activeSession,
        events,
        now: new Date('2026-09-30T10:07:30.000Z'),
      },
    )
    execution = extraExpired.execution
    events = extraExpired.events
    expect(execution.boutPhase).toBe('pending_activity_decision')
    const officialEndedAt = execution.officialEndedAt

    const enterCorrection = runMatControlCommand(
      'CORRECT_BEFORE_ACTIVITY',
      { enable: true },
      { execution, session: activeSession, events },
    )
    execution = enterCorrection.execution
    expect(execution.activityCorrectionMode).toBe(true)

    const fixScore = runMatControlCommand(
      'TECHNICAL_SCORE',
      { entryId: 'red-1', corner: 'red', points: 2 },
      { execution, session: activeSession, events },
    )
    execution = fixScore.execution
    events = fixScore.events

    const finishCorrection = runMatControlCommand('FINISH_ACTIVITY_CORRECTION', {}, {
      execution,
      session: activeSession,
      events,
    })
    execution = finishCorrection.execution
    events = finishCorrection.events
    expect(execution.boutPhase).toBe('pending_confirmation')
    expect(execution.activityCorrectionMode).toBe(false)
    expect(execution.officialEndedAt).toEqual(officialEndedAt)

    const confirmed = runMatControlCommand('CONFIRM', {}, {
      execution,
      session: activeSession,
      events,
    })
    expect(confirmed.execution.boutPhase).toBe('confirmed')
  })
})
