import { describe, expect, it } from 'vitest'
import { awardedPointsForSanction } from '../../config/fseRules'
import { buildPenaltyEventPayload, reduceScoreEvents } from '../scoreEngine'
import type { BoutEventRecord } from '../mat-control/types'
import type { PenaltySanction } from '../../config/fseRules'

function penaltyEvent(
  sequence: number,
  corner: 'red' | 'blue',
  entryId: string,
  sanction: PenaltySanction,
  ladder: 'GENERAL' | 'OUT_OF_BOUNDS' | 'PASSIVITY' = 'GENERAL',
): BoutEventRecord {
  const points = awardedPointsForSanction(sanction)
  return {
    id: `evt-${sequence}`,
    boutId: 'bout-1',
    clientEventId: `client-${sequence}`,
    sequence,
    eventType: 'PENALTY',
    entryId,
    cornerAtEvent: corner,
    points,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload: buildPenaltyEventPayload({ ladder, sanction }),
    undoneAt: null,
    createdAt: new Date(),
  }
}

describe('scoreEngine penalties', () => {
  it('awards WARNING_1 to opponent and increments periodPenaltyCount', () => {
    const state = reduceScoreEvents(
      [penaltyEvent(1, 'blue', 'blue-1', 'WARNING_1')],
      'main',
      1,
    )
    expect(state.officialScore).toEqual({ red: 1, blue: 0 })
    expect(state.periodPenaltyCount.blue).toBe(1)
    expect(state.generalDisciplinaryLadder.blue).toBe('WARNING_1')
  })

  it('awards three points on third warning', () => {
    const state = reduceScoreEvents(
      [penaltyEvent(1, 'red', 'red-1', 'WARNING_3')],
      'main',
      1,
    )
    expect(state.officialScore).toEqual({ red: 0, blue: 3 })
    expect(state.generalDisciplinaryLadder.red).toBe('WARNING_3')
  })

  it('counts legacy REMARK as zero points but increments periodPenaltyCount', () => {
    const state = reduceScoreEvents(
      [penaltyEvent(1, 'red', 'red-1', 'REMARK')],
      'main',
      1,
    )
    expect(state.officialScore).toEqual({ red: 0, blue: 0 })
    expect(state.periodPenaltyCount.red).toBe(1)
  })

  it('tracks OUT_OF_BOUNDS ladder separately from general ladder', () => {
    const state = reduceScoreEvents(
      [penaltyEvent(1, 'blue', 'blue-1', 'WARNING_1', 'OUT_OF_BOUNDS')],
      'main',
      1,
    )
    expect(state.periodPenaltyCount.blue).toBe(1)
    expect(state.outOfBoundsLadder.blue).toBe('WARNING_1')
    expect(state.generalDisciplinaryLadder.blue).toBeNull()
  })

  it('tracks passivity ladder separately from general and out-of-bounds', () => {
    const state = reduceScoreEvents(
      [
        penaltyEvent(2, 'red', 'red-1', 'WARNING_1', 'PASSIVITY'),
        penaltyEvent(3, 'red', 'red-1', 'WARNING_2', 'PASSIVITY'),
      ],
      'main',
      1,
    )

    expect(state.passivityLadder.red).toBe('WARNING_2')
    expect(state.generalDisciplinaryLadder.red).toBeNull()
    expect(state.outOfBoundsLadder.red).toBeNull()
    expect(state.officialScore.blue).toBe(3)
  })
})
