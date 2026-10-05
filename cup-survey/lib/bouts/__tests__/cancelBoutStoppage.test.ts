import { describe, expect, it } from 'vitest'
import { cancelBoutStoppage } from '../cancelBoutStoppage'
import type { BoutEventRecord, MatControlExecution, MatControlSessionRecord } from '../mat-control/types'

const session: MatControlSessionRecord = {
  tournamentScopeId: 'cup-2026',
  matIndex: 1,
  activeBoutId: 'bout-1',
  revision: 0,
  holderToken: 'token',
  holderSince: new Date(),
  heartbeatAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
}

const baseExecution: MatControlExecution = {
  id: 'exec-1',
  boutId: 'bout-1',
  tournamentScopeId: 'cup-2026',
  actualStartAt: null,
  actualEndAt: null,
  officialStartedAt: null,
  officialEndedAt: new Date(),
  mainEndedAt: null,
  extraEndedAt: null,
  activityCorrectionMode: false,
  periodCorrectionMode: false,
  attemptNumber: 1,
  boutPhase: 'pending_confirmation',
  clockState: 'stopped',
  clockStartedAt: null,
  clockElapsedBeforeStartMs: 0,
  currentPeriod: 'main',
  nextEventSequence: 2,
  liveRevision: 1,
  liveSnapshot: null,
}

function stoppage(trigger: string): BoutEventRecord {
  return {
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
    period: 'main',
    attemptNumber: 1,
    payload: { trigger },
    undoneAt: null,
    createdAt: new Date(),
  }
}

describe('cancelBoutStoppage', () => {
  it('reverts NO_SHOW to scheduled and clears active bout', () => {
    const result = cancelBoutStoppage({
      execution: baseExecution,
      session,
      stoppageEvent: stoppage('NO_SHOW'),
      now: new Date(),
    })

    expect(result.mode).toBe('NO_SHOW_REVERT')
    expect(result.execution.boutPhase).toBe('scheduled')
    expect(result.execution.clockState).toBe('idle')
    expect(result.session.activeBoutId).toBeNull()
  })

  it('enters period correction after TIME_EXPIRED cancel', () => {
    const result = cancelBoutStoppage({
      execution: { ...baseExecution, officialStartedAt: new Date() },
      session,
      stoppageEvent: stoppage('TIME_EXPIRED'),
      now: new Date(),
    })

    expect(result.mode).toBe('PERIOD_END_CORRECTION')
    expect(result.execution.periodCorrectionMode).toBe(true)
    expect(result.execution.boutPhase).toBe('live')
  })

  it('reverts activity correction stoppage to pending_activity_decision', () => {
    const result = cancelBoutStoppage({
      execution: {
        ...baseExecution,
        boutPhase: 'pending_confirmation',
        officialStartedAt: new Date(),
        officialEndedAt: new Date(),
        mainEndedAt: new Date(),
        extraEndedAt: new Date(),
        currentPeriod: 'extra',
      },
      session,
      stoppageEvent: stoppage('ACTIVITY_CORRECTION'),
      now: new Date(),
    })

    expect(result.mode).toBe('ACTIVITY_DECISION_REVERT')
    expect(result.execution.boutPhase).toBe('pending_activity_decision')
  })

  it('reverts activity decision to pending_activity_decision', () => {
    const result = cancelBoutStoppage({
      execution: {
        ...baseExecution,
        boutPhase: 'pending_confirmation',
        officialStartedAt: new Date(),
        officialEndedAt: new Date(),
        mainEndedAt: new Date(),
        extraEndedAt: new Date(),
      },
      session,
      stoppageEvent: stoppage('EXTRA_ACTIVITY'),
      now: new Date(),
    })

    expect(result.mode).toBe('ACTIVITY_DECISION_REVERT')
    expect(result.execution.boutPhase).toBe('pending_activity_decision')
    expect(result.execution.activityCorrectionMode).toBe(false)
  })

  it('returns to scheduled after pre-fight stoppage cancel', () => {
    const result = cancelBoutStoppage({
      execution: baseExecution,
      session,
      stoppageEvent: stoppage('FORFEIT'),
      now: new Date(),
    })

    expect(result.mode).toBe('EARLY_STOPPAGE_REVERT')
    expect(result.execution.boutPhase).toBe('scheduled')
    expect(result.execution.clockState).toBe('idle')
    expect(result.execution.officialStartedAt).toBeNull()
  })

  it('returns to live after early stoppage cancel', () => {
    const result = cancelBoutStoppage({
      execution: { ...baseExecution, officialStartedAt: new Date(), boutPhase: 'pending_confirmation' },
      session,
      stoppageEvent: stoppage('SUBMISSION'),
      now: new Date(),
    })

    expect(result.mode).toBe('EARLY_STOPPAGE_REVERT')
    expect(result.execution.boutPhase).toBe('live')
    expect(result.execution.officialEndedAt).toBeNull()
  })
})
