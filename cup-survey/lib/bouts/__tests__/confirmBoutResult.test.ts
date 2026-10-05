import { describe, expect, it } from 'vitest'
import { confirmBoutResult } from '../confirmBoutResult'
import { baseExecution, defaultSession } from './matControlTestHelpers'

describe('confirmBoutResult', () => {
  it('confirms pending bout and keeps activeBoutId without shifting officialEndedAt', () => {
    const officialEndedAt = new Date('2026-09-30T10:03:00.000Z')
    const now = new Date('2026-09-30T10:03:30.000Z')

    const result = confirmBoutResult({
      execution: baseExecution({
        boutPhase: 'pending_confirmation',
        officialEndedAt,
      }),
      session: { ...defaultSession, activeBoutId: 'bout-1' },
      decision: {
        winnerEntryId: 'red-1',
        loserEntryId: 'blue-1',
        reason: 'TOTAL_SCORE',
        decidedInPeriod: 'main',
      },
      victoryMethod: 'POINTS',
      now,
      confirmedBy: 'admin',
    })

    expect(result.execution.boutPhase).toBe('confirmed')
    expect(result.execution.actualStartAt).toEqual(now)
    expect(result.session.activeBoutId).toBe('bout-1')
    expect(result.resultPayload.officialEndedAt).toBe(officialEndedAt.toISOString())
    expect(result.resultPayload.resultConfirmedAt).toBe(now.toISOString())
  })

  it('backfills actualStartAt from officialStartedAt when missing', () => {
    const officialStartedAt = new Date('2026-09-30T10:00:00.000Z')
    const now = new Date('2026-09-30T10:03:30.000Z')

    const result = confirmBoutResult({
      execution: baseExecution({
        boutPhase: 'pending_confirmation',
        officialStartedAt,
        officialEndedAt: new Date('2026-09-30T10:03:00.000Z'),
      }),
      session: defaultSession,
      decision: {
        winnerEntryId: 'red-1',
        loserEntryId: 'blue-1',
        reason: 'TOTAL_SCORE',
        decidedInPeriod: 'main',
      },
      victoryMethod: 'POINTS',
      now,
    })

    expect(result.execution.actualStartAt).toEqual(officialStartedAt)
  })

  it('rejects confirm outside pending_confirmation', () => {
    expect(() =>
      confirmBoutResult({
        execution: baseExecution({ boutPhase: 'live' }),
        session: defaultSession,
        decision: {
          winnerEntryId: 'red-1',
          loserEntryId: 'blue-1',
          reason: 'TOTAL_SCORE',
          decidedInPeriod: 'main',
        },
        victoryMethod: 'POINTS',
        now: new Date(),
      }),
    ).toThrow('confirmBoutResult доступен только в pending_confirmation')
  })
})
