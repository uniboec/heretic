import { describe, expect, it } from 'vitest'
import { ATHLETE_DOCTOR_REMOVAL_MS } from '../athleteDoctorVisit'
import { buildBoutConfirmationSummary } from '../formatBoutConfirmation'
import { resolveFastestFightBoutResultFields } from '../../fastestFights/resolveFastestFightBoutResultFields'
import { resolveEffectiveBoutStoppage } from '../resolveEffectiveBoutStoppage'
import { resolveEffectiveBoutDecision } from '../scoreEngine'
import {
  applySharedEpisodeTie,
  baseExecution,
  defaultParticipants,
  defaultSession,
  runMatControlCommand,
} from './matControlTestHelpers'

function startLiveBout() {
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
  return {
    execution: fight.execution,
    session: fight.session,
    events: fight.events,
  }
}

function confirmAndInspect(state: {
  execution: ReturnType<typeof baseExecution>
  session: typeof defaultSession
  events: typeof import('../mat-control/types').BoutEventRecord[]
}) {
  const decision = resolveEffectiveBoutDecision({
    events: state.events,
    period: state.execution.currentPeriod,
    attemptNumber: state.execution.attemptNumber,
    participants: defaultParticipants,
  })
  const summary = buildBoutConfirmationSummary({
    events: state.events,
    decision,
    redEntryId: defaultParticipants.redEntryId,
    blueEntryId: defaultParticipants.blueEntryId,
    redName: 'Красный',
    blueName: 'Синий',
    mainRedScore: 0,
    mainBlueScore: 0,
  })
  const confirmed = runMatControlCommand('CONFIRM', {}, state)
  const stoppage = [...state.events]
    .reverse()
    .find((event) => !event.undoneAt && event.eventType === 'BOUT_STOPPAGE')
  const payload = stoppage?.payload as {
    proposedVictoryMethod?: string
    proposedDecisionReason?: string
  }

  return {
    decision,
    summary,
    confirmed,
    proposedVictoryMethod: payload?.proposedVictoryMethod,
    proposedDecisionReason: payload?.proposedDecisionReason,
    result: confirmed.response.result as {
      victoryMethod: string
      decisionReason: string
      winnerEntryId: string | null
    },
  }
}

describe('mat control victory methods', () => {
  it('allows finishing a scheduled bout without pressing fight', () => {
    const stopped = runMatControlCommand(
      'STOPPAGE_FORFEIT',
      { forfeitingCorner: 'blue' },
      {
        execution: baseExecution(),
        session: defaultSession,
        events: [],
      },
    )

    expect(stopped.execution.boutPhase).toBe('pending_confirmation')
    expect(stopped.execution.officialStartedAt).toBeNull()

    const { decision, result } = confirmAndInspect(stopped)
    expect(decision.winnerEntryId).toBe('red-1')
    expect(decision.reason).toBe('FORFEIT')
    expect(result.victoryMethod).toBe('FORFEIT')
  })

  it('confirms clear advantage with Я.П. label', () => {
    const live = startLiveBout()
    const stopped = runMatControlCommand(
      'STOPPAGE_CLEAR_ADVANTAGE',
      { winnerCorner: 'red' },
      live,
    )
    expect(stopped.execution.boutPhase).toBe('pending_confirmation')

    const { decision, summary, result, confirmed, proposedVictoryMethod } = confirmAndInspect(stopped)
    expect(decision.winnerEntryId).toBe('red-1')
    expect(decision.reason).toBe('CLEAR_ADVANTAGE')
    expect(proposedVictoryMethod).toBe('CLEAR_ADVANTAGE')
    expect(summary.victoryMethodLabel).toBe('Я.П.')
    expect(result.victoryMethod).toBe('CLEAR_ADVANTAGE')
    expect(confirmed.execution.boutPhase).toBe('confirmed')
  })

  it('confirms submission with subtype label', () => {
    const live = startLiveBout()
    const stopped = runMatControlCommand(
      'STOPPAGE_SUBMISSION',
      { winnerCorner: 'blue', submissionSubtype: 'LEG' },
      live,
    )

    const { decision, summary, result } = confirmAndInspect(stopped)
    expect(decision.winnerEntryId).toBe('blue-1')
    expect(decision.reason).toBe('SUBMISSION')
    expect(summary.victoryMethodLabel).toBe('Б.П. (нога)')
    expect(result.victoryMethod).toBe('SUBMISSION')
  })

  it('confirms choke victory', () => {
    const live = startLiveBout()
    const stopped = runMatControlCommand('STOPPAGE_CHOKE', { winnerCorner: 'red' }, live)

    const { decision, summary, result } = confirmAndInspect(stopped)
    expect(decision.reason).toBe('CHOKE')
    expect(summary.victoryMethodLabel).toBe('У.П.')
    expect(result.victoryMethod).toBe('CHOKE')
  })

  it('confirms forfeit victory', () => {
    const live = startLiveBout()
    const stopped = runMatControlCommand('STOPPAGE_FORFEIT', { forfeitingCorner: 'blue' }, live)

    const { decision, summary, result } = confirmAndInspect(stopped)
    expect(decision.winnerEntryId).toBe('red-1')
    expect(decision.reason).toBe('FORFEIT')
    expect(summary.victoryMethodLabel).toContain('О.Т.К.')
    expect(result.victoryMethod).toBe('FORFEIT')
  })

  it('confirms injury victory with winner shown at 0:0', () => {
    const live = startLiveBout()
    const stopped = runMatControlCommand('STOPPAGE_INJURY', { injuredCorner: 'red' }, live)

    const { decision, summary, result } = confirmAndInspect(stopped)
    expect(decision.winnerEntryId).toBe('blue-1')
    expect(decision.reason).toBe('INJURY')
    expect(summary.winnerLabel).toBe('Синий')
    expect(summary.victoryMethodLabel).toBe('Н.П.Б.')
    expect(result.victoryMethod).toBe('INJURY')
  })

  it('confirms no-show after secondary call timeout', () => {
    const t0 = new Date('2026-09-30T10:00:00.000Z')
    const tAfterSecondary = new Date('2026-09-30T10:02:01.000Z')
    let execution = baseExecution()
    let events: typeof import('../mat-control/types').BoutEventRecord[] = []
    let session = defaultSession

    for (const corner of ['red', 'blue'] as const) {
      const call = runMatControlCommand(
        'FIRST_CALL',
        { entryId: corner === 'red' ? 'red-1' : 'blue-1', corner },
        { execution, session, events, now: t0 },
      )
      execution = call.execution
      events = call.events
    }

    const secondary = runMatControlCommand(
      'SECONDARY_CALL',
      { entryId: 'blue-1', corner: 'blue' },
      { execution, session, events, now: t0 },
    )
    execution = secondary.execution
    events = secondary.events

    const stopped = runMatControlCommand(
      'NO_SHOW',
      { entryId: 'blue-1', corner: 'blue' },
      { execution, session, events, now: tAfterSecondary },
    )
    expect(stopped.execution.boutPhase).toBe('pending_confirmation')

    const { decision, summary, result } = confirmAndInspect(stopped)
    expect(decision.winnerEntryId).toBe('red-1')
    expect(decision.reason).toBe('NO_SHOW')
    expect(summary.victoryMethodLabel).toBe('Н.Я.')
    expect(result.victoryMethod).toBe('NO_SHOW')
  })

  it('confirms points victory after main time expires with leader', () => {
    const live = startLiveBout()
    const scored = runMatControlCommand(
      'TECHNICAL_SCORE',
      { entryId: 'red-1', corner: 'red', points: 4, adminOverrideReason: 'test setup' },
      live,
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

    const { decision, summary, result } = confirmAndInspect(expired)
    expect(decision.winnerEntryId).toBe('red-1')
    expect(decision.reason).toBe('TOTAL_SCORE')
    expect(summary.victoryMethodLabel).toBe('П.Б.')
    expect(result.victoryMethod).toBe('POINTS')
    expect(result.decisionReason).toBe('TOTAL_SCORE')
  })

  it('confirms disqualification via penalty ladder', () => {
    const live = startLiveBout()
    const stopped = runMatControlCommand(
      'PENALTY_DISQUALIFY',
      { corner: 'red', entryId: 'red-1', ladder: 'GENERAL' },
      live,
    )
    expect(stopped.execution.boutPhase).toBe('pending_confirmation')

    const { decision, summary, result } = confirmAndInspect(stopped)
    expect(decision.winnerEntryId).toBe('blue-1')
    expect(decision.reason).toBe('DISQUALIFICATION')
    expect(summary.victoryMethodLabel).toBe('Д.С.К.')
    expect(result.victoryMethod).toBe('DISQUALIFICATION')
  })

  it('confirms doctor removal as injury victory', () => {
    const t0 = new Date('2026-09-30T10:00:00.000Z')
    const tRemoval = new Date(t0.getTime() + ATHLETE_DOCTOR_REMOVAL_MS)
    const live = startLiveBout()

    const doctorStart = runMatControlCommand(
      'ATHLETE_DOCTOR_START',
      { entryId: 'red-1', corner: 'red' },
      { ...live, now: t0 },
    )
    const stopped = runMatControlCommand(
      'ATHLETE_DOCTOR_REMOVAL',
      { entryId: 'red-1', corner: 'red' },
      {
        execution: doctorStart.execution,
        session: doctorStart.session,
        events: doctorStart.events,
        now: tRemoval,
      },
    )
    expect(stopped.execution.boutPhase).toBe('pending_confirmation')

    const { decision, summary, result } = confirmAndInspect(stopped)
    expect(decision.winnerEntryId).toBe('blue-1')
    expect(decision.reason).toBe('INJURY')
    expect(summary.victoryMethodLabel).toBe('Н.П.Б.')
    expect(result.victoryMethod).toBe('INJURY')
  })

  it('confirms extra activity decision with Активнее label', () => {
    let state = startLiveBout()

    const mainTie = applySharedEpisodeTie(state, 2, 2, 'main-tie')
    state = { ...state, ...mainTie }

    const mainExpired = runMatControlCommand(
      'EXPIRE_PERIOD',
      { period: 'main', periodDurationMs: 180_000 },
      {
        ...state,
        execution: { ...state.execution, clockElapsedBeforeStartMs: 180_000 },
        now: new Date('2026-09-30T10:03:30.000Z'),
      },
    )
    state = { execution: mainExpired.execution, session: mainExpired.session, events: mainExpired.events }
    expect(state.execution.currentPeriod).toBe('extra')

    const extraStart = runMatControlCommand('CLOCK_START', {}, state)
    state = { execution: extraStart.execution, session: extraStart.session, events: extraStart.events }

    const extraTie = applySharedEpisodeTie(state, 2, 2, 'extra-tie')
    state = { ...state, ...extraTie }

    const extraExpired = runMatControlCommand(
      'EXPIRE_PERIOD',
      { period: 'extra', periodDurationMs: 180_000 },
      {
        ...state,
        execution: { ...state.execution, clockElapsedBeforeStartMs: 180_000 },
        now: new Date('2026-09-30T10:07:30.000Z'),
      },
    )
    state = { execution: extraExpired.execution, session: extraExpired.session, events: extraExpired.events }
    expect(state.execution.boutPhase).toBe('pending_activity_decision')

    const decided = runMatControlCommand('EXTRA_ACTIVITY_DECIDE', { winnerCorner: 'red' }, state)
    expect(decided.execution.boutPhase).toBe('pending_confirmation')

    const { decision, summary, result, proposedVictoryMethod } = confirmAndInspect(decided)
    expect(decision.winnerEntryId).toBe('red-1')
    expect(decision.reason).toBe('EXTRA_ACTIVITY')
    expect(proposedVictoryMethod).toBe('POINTS')
    expect(summary.victoryMethodLabel).toBe('Активнее')
    expect(result.victoryMethod).toBe('POINTS')
    expect(result.decisionReason).toBe('EXTRA_ACTIVITY')
  })

  it('resolves ranking fields from submission stoppage on confirm', () => {
    const live = startLiveBout()
    const stopped = runMatControlCommand(
      'STOPPAGE_SUBMISSION',
      { winnerCorner: 'red', submissionSubtype: 'ARM' },
      {
        ...live,
        now: new Date('2026-09-30T10:00:42.000Z'),
      },
    )
    const { confirmed, result } = confirmAndInspect(stopped)
    const stoppage = resolveEffectiveBoutStoppage(confirmed.events)
    const fields = resolveFastestFightBoutResultFields(result.victoryMethod, stoppage, {
      fightOfficiallyStarted: true,
    })

    expect(stoppage?.eventId).toBeTruthy()
    expect(fields.boutElapsedMs).toBeGreaterThanOrEqual(1000)
    expect(fields.stoppageEventId).toBe(stoppage?.eventId)
    expect(fields.stoppageTrigger).toBeTruthy()
  })

  it('keeps audit snapshot but clears ranking time for forfeit', () => {
    const live = startLiveBout()
    const stopped = runMatControlCommand('STOPPAGE_FORFEIT', { forfeitingCorner: 'blue' }, live)
    const { confirmed, result } = confirmAndInspect(stopped)
    const fields = resolveFastestFightBoutResultFields(
      result.victoryMethod,
      resolveEffectiveBoutStoppage(confirmed.events),
      { fightOfficiallyStarted: true },
    )

    expect(fields.stoppageEventId).toBeTruthy()
    expect(fields.boutElapsedMs).toBeNull()
  })
})
