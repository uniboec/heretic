import { describe, expect, it } from 'vitest'
import type { BoutEventRecord } from '../mat-control/types'

function technicalScore(sequence: number, corner: 'red' | 'blue', points: number): BoutEventRecord {
  return {
    id: `evt-${sequence}`,
    boutId: 'bout-1',
    clientEventId: `client-${sequence}`,
    sequence,
    eventType: 'TECHNICAL_SCORE',
    entryId: corner === 'red' ? 'red-1' : 'blue-1',
    cornerAtEvent: corner,
    points,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload: null,
    undoneAt: null,
    createdAt: new Date(),
  }
}

describe('public live bout score helpers', () => {
  it('aggregates official score from active events', async () => {
    const { reduceScoreEvents } = await import('../scoreEngine')
    const score = reduceScoreEvents(
      [technicalScore(1, 'red', 3), technicalScore(2, 'blue', 1)],
      'main',
      1,
    )
    expect(score.officialScore).toEqual({ red: 3, blue: 1 })
  })
})
