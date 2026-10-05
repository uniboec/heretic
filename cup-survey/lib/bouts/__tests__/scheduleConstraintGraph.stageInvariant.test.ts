import { describe, expect, it } from 'vitest'
import { InvalidScheduleInvariantError } from '../errors'
import {
  buildScheduleConstraintGraph,
  effectivePinnedPartition,
} from '../scheduleConstraintGraph'
import { buildSportDependencyGraph } from '../sportDependencies'
import { makeTestBout } from './testBoutHelpers'

describe('scheduleConstraintGraph stage invariant', () => {
  it('throws when sport edge crosses stages', () => {
    const stage1 = makeTestBout({
      id: 'cat:a::semi',
      categoryKey: 'cat:a',
      competitionStage: 1,
      schedulePhase: 'elimination',
      round: 2,
      roundsUntilFinal: 1,
    })
    const stage2 = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      competitionStage: 2,
      schedulePhase: 'final',
      round: 3,
      sideA: { kind: 'hint', label: 'W', source: { matchId: 'semi', outcome: 'winner' } },
      sideB: { kind: 'bye' },
    })
    const bouts = [stage1, stage2]
    const sportGraph = buildSportDependencyGraph(bouts, new Set(bouts.map((bout) => bout.id)))
    const partitions = new Map(
      bouts.map((bout) => [
        bout.id,
        effectivePinnedPartition(bout, {}, false, new Set()),
      ]),
    )

    expect(() =>
      buildScheduleConstraintGraph({
        bouts,
        boutsByMat: new Map([[1, bouts]]),
        sportGraph,
        overrides: {},
        pinAllFinalsToEnd: false,
        pinnedClosure: new Set(),
        partitions,
      }),
    ).toThrow(InvalidScheduleInvariantError)
  })
})
