import { describe, expect, it } from 'vitest'
import { cancelBoutStoppage } from '../cancelBoutStoppage'
import type { BoutEventRecord, MatControlSessionRecord } from '../mat-control/types'
import { baseExecution } from './matControlTestHelpers'

const session: MatControlSessionRecord = {
  tournamentScopeId: 'cup-2026',
  matIndex: 1,
  activeBoutId: 'cat::bout-1',
  revision: 1,
  holderToken: 'token',
  holderSince: new Date(),
  heartbeatAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
}

function callEvent(sequence: number, corner: 'red' | 'blue'): BoutEventRecord {
  return {
    id: `evt-${sequence}`,
    boutId: 'cat::bout-1',
    clientEventId: `client-${sequence}`,
    sequence,
    eventType: 'FIRST_CALL',
    entryId: corner === 'red' ? 'red-1' : 'blue-1',
    cornerAtEvent: corner,
    points: null,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload: null,
    undoneAt: null,
    createdAt: new Date(),
  }
}

describe('cancelBoutStoppage NO_SHOW_REVERT', () => {
  it('returns bout to scheduled and clears active bout without removing call events', () => {
    const events = [callEvent(1, 'red'), callEvent(2, 'blue')]
    const stoppage: BoutEventRecord = {
      id: 'stoppage-3',
      boutId: 'cat::bout-1',
      clientEventId: 'stoppage',
      sequence: 3,
      eventType: 'BOUT_STOPPAGE',
      entryId: null,
      cornerAtEvent: null,
      points: null,
      episodeId: null,
      boutElapsedMs: 0,
      period: 'main',
      attemptNumber: 1,
      payload: { trigger: 'NO_SHOW' },
      undoneAt: null,
      createdAt: new Date(),
    }

    const result = cancelBoutStoppage({
      execution: baseExecution({
        boutPhase: 'pending_confirmation',
        officialStartedAt: null,
      }),
      session,
      stoppageEvent: stoppage,
      now: new Date(),
    })

    expect(result.mode).toBe('NO_SHOW_REVERT')
    expect(result.execution.boutPhase).toBe('scheduled')
    expect(result.execution.clockState).toBe('idle')
    expect(result.session.activeBoutId).toBeNull()
    expect(events.every((event) => event.undoneAt == null)).toBe(true)
  })
})
