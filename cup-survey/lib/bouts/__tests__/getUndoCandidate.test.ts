import { describe, expect, it } from 'vitest'
import { getUndoCandidate } from '../getUndoCandidate'
import { baseExecution } from './matControlTestHelpers'
import type { BoutEventRecord } from '../mat-control/types'

function scoreEvent(sequence: number): BoutEventRecord {
  return {
    id: `evt-${sequence}`,
    boutId: 'bout-1',
    clientEventId: `c-${sequence}`,
    sequence,
    eventType: 'TECHNICAL_SCORE',
    entryId: 'red-1',
    cornerAtEvent: 'red',
    points: 2,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload: null,
    undoneAt: null,
    createdAt: new Date('2026-09-30T10:00:00.000Z'),
  }
}

describe('getUndoCandidate', () => {
  it('returns undo candidate in scheduled phase when prep events exist', () => {
    const execution = baseExecution({ boutPhase: 'scheduled' })
    const candidate = getUndoCandidate({ execution, events: [scoreEvent(0)] })
    expect(candidate?.primaryEventType).toBe('TECHNICAL_SCORE')
    expect(candidate?.semantic).toMatchObject({ kind: 'TECHNICAL_SCORE', corner: 'red', points: 2 })
  })

  it('returns technical score semantic in live phase', () => {
    const execution = baseExecution({
      boutPhase: 'live',
      officialStartedAt: new Date('2026-09-30T10:00:00.000Z'),
    })
    const candidate = getUndoCandidate({ execution, events: [scoreEvent(0)] })
    expect(candidate?.semantic).toEqual({
      kind: 'TECHNICAL_SCORE',
      corner: 'red',
      points: 2,
      actionLabel: null,
    })
    expect(candidate?.primaryEventType).toBe('TECHNICAL_SCORE')
  })

  it('returns null in pending_confirmation phase', () => {
    const execution = baseExecution({ boutPhase: 'pending_confirmation' })
    expect(getUndoCandidate({ execution, events: [scoreEvent(0)] })).toBeNull()
  })
})
