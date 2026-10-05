import { describe, expect, it } from 'vitest'
import { assertExtraPeriodUndoTargets, previewUndoTargets } from '../compoundUndo'
import type { BoutEventRecord } from '../mat-control/types'
import { CommandNotAllowedError } from '../mat-control/errors'

function event(sequence: number, period: 'main' | 'extra'): BoutEventRecord {
  return {
    id: `evt-${sequence}`,
    boutId: 'bout-1',
    clientEventId: `client-${sequence}`,
    sequence,
    eventType: 'TECHNICAL_SCORE',
    entryId: 'red-1',
    cornerAtEvent: 'red',
    points: 2,
    episodeId: `ep-${sequence}`,
    boutElapsedMs: 0,
    period,
    attemptNumber: 1,
    payload: null,
    undoneAt: null,
    createdAt: new Date(),
  }
}

describe('activity correction undo guards', () => {
  it('rejects undo targets from main period', () => {
    const events = [event(1, 'main'), event(2, 'extra')]
    const targets = previewUndoTargets({
      events,
      attemptNumber: 1,
      payload: { targetEventIds: ['evt-1'] },
    })
    expect(() => assertExtraPeriodUndoTargets(targets)).toThrow(CommandNotAllowedError)
  })

  it('allows undo targets from extra period only', () => {
    const events = [event(1, 'main'), event(2, 'extra')]
    const targets = previewUndoTargets({
      events,
      attemptNumber: 1,
      payload: { targetEventIds: ['evt-2'] },
    })
    expect(() => assertExtraPeriodUndoTargets(targets)).not.toThrow()
  })
})
