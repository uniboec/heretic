import { describe, expect, it } from 'vitest'
import { assertCommandAllowed } from '../assertCommandAllowed'
import { CommandNotAllowedError } from '../mat-control/errors'
import type { MatControlExecution } from '../mat-control/types'

const base: MatControlExecution = {
  id: 'e1',
  boutId: 'b1',
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

describe('assertCommandAllowed', () => {
  it('allows workspace commands in scheduled including scoring', () => {
    expect(() => assertCommandAllowed(base, 'FIRST_CALL')).not.toThrow()
    expect(() => assertCommandAllowed(base, 'TECHNICAL_SCORE')).not.toThrow()
    expect(() => assertCommandAllowed(base, 'PASSIVITY_START')).not.toThrow()
    expect(() => assertCommandAllowed(base, 'SET_BOUT_TIMING')).not.toThrow()
    expect(() => assertCommandAllowed(base, 'EXPIRE_PERIOD')).toThrow(CommandNotAllowedError)
  })

  it('allows stoppage commands in scheduled without starting the fight', () => {
    expect(() => assertCommandAllowed(base, 'STOPPAGE_SUBMISSION')).not.toThrow()
    expect(() => assertCommandAllowed(base, 'STOPPAGE_CHOKE')).not.toThrow()
    expect(() => assertCommandAllowed(base, 'STOPPAGE_FORFEIT')).not.toThrow()
    expect(() => assertCommandAllowed(base, 'STOPPAGE_INJURY')).not.toThrow()
    expect(() => assertCommandAllowed(base, 'STOPPAGE_CLEAR_ADVANTAGE')).not.toThrow()
  })

  it('allows athlete wait commands in scheduled and live phases', () => {
    expect(() => assertCommandAllowed(base, 'ATHLETE_WAIT_START')).not.toThrow()
    expect(() => assertCommandAllowed(base, 'ATHLETE_WAIT_END')).not.toThrow()
    const live = { ...base, boutPhase: 'live' as const }
    expect(() => assertCommandAllowed(live, 'ATHLETE_WAIT_START')).not.toThrow()
    expect(() => assertCommandAllowed(live, 'ATHLETE_WAIT_END')).not.toThrow()
  })

  it('allows scoring after live phase', () => {
    const live = { ...base, boutPhase: 'live' as const }
    expect(() => assertCommandAllowed(live, 'TECHNICAL_SCORE')).not.toThrow()
    expect(() => assertCommandAllowed(live, 'SET_BOUT_TIMING')).not.toThrow()
  })

  it('allows FINISH_ACTIVITY_CORRECTION in activity correction mode', () => {
    const execution = {
      ...base,
      boutPhase: 'pending_activity_decision' as const,
      activityCorrectionMode: true,
      currentPeriod: 'extra' as const,
    }
    expect(() => assertCommandAllowed(execution, 'FINISH_ACTIVITY_CORRECTION')).not.toThrow()
    expect(() => assertCommandAllowed(execution, 'FINISH_PERIOD_CORRECTION')).toThrow(
      CommandNotAllowedError,
    )
    expect(() => assertCommandAllowed(execution, 'ADJUDICATION_SCORE')).toThrow(
      CommandNotAllowedError,
    )
  })

  it('blocks extra activity decision during activity correction mode', () => {
    const execution = {
      ...base,
      boutPhase: 'pending_activity_decision' as const,
      activityCorrectionMode: true,
      currentPeriod: 'extra' as const,
    }
    expect(() => assertCommandAllowed(execution, 'EXTRA_ACTIVITY_DECIDE')).toThrow(
      CommandNotAllowedError,
    )
  })

  it('rejects undo after confirmed bout', () => {
    const execution = { ...base, boutPhase: 'confirmed' as const }
    expect(() => assertCommandAllowed(execution, 'UNDO')).toThrow(CommandNotAllowedError)
  })

  it('allows RESET_BOUT in any phase including confirmed', () => {
    expect(() => assertCommandAllowed(base, 'RESET_BOUT')).not.toThrow()
    expect(() =>
      assertCommandAllowed({ ...base, boutPhase: 'confirmed' as const }, 'RESET_BOUT'),
    ).not.toThrow()
  })

  it('allows CORNER_SWAP in any phase including live and confirmed', () => {
    expect(() => assertCommandAllowed(base, 'CORNER_SWAP')).not.toThrow()
    expect(() =>
      assertCommandAllowed({ ...base, boutPhase: 'live' as const }, 'CORNER_SWAP'),
    ).not.toThrow()
    expect(() =>
      assertCommandAllowed({ ...base, boutPhase: 'confirmed' as const }, 'CORNER_SWAP'),
    ).not.toThrow()
    expect(() =>
      assertCommandAllowed(
        { ...base, boutPhase: 'live' as const, periodCorrectionMode: true },
        'CORNER_SWAP',
      ),
    ).not.toThrow()
  })

  it('allows OPEN_NEXT_BOUT only in confirmed phase', () => {
    const confirmed = { ...base, boutPhase: 'confirmed' as const }
    expect(() => assertCommandAllowed(confirmed, 'OPEN_NEXT_BOUT')).not.toThrow()
    expect(() => assertCommandAllowed(base, 'OPEN_NEXT_BOUT')).toThrow(CommandNotAllowedError)
  })

  it('allows FINISH_PERIOD_CORRECTION in period correction mode', () => {
    const execution = {
      ...base,
      boutPhase: 'live' as const,
      periodCorrectionMode: true,
    }
    expect(() => assertCommandAllowed(execution, 'FINISH_PERIOD_CORRECTION')).not.toThrow()
    expect(() => assertCommandAllowed(execution, 'CLOCK_START')).toThrow(CommandNotAllowedError)
  })

  it('rejects FINISH_PERIOD_CORRECTION outside period correction mode', () => {
    const execution = { ...base, boutPhase: 'live' as const, periodCorrectionMode: false }
    expect(() => assertCommandAllowed(execution, 'FINISH_PERIOD_CORRECTION')).toThrow(
      CommandNotAllowedError,
    )
  })
})
