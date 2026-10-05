import { describe, expect, it } from 'vitest'
import { resolveDownstreamBoutIds } from '../sportDependencies'
import type { InternalBout } from '../types'

function bout(id: string, feederMatchId?: string): InternalBout {
  return {
    id,
    matchNumber: 1,
    categoryKey: 'cat-1',
    categoryTitle: 'Cat',
    discipline: 'TC',
    storedMatIndex: 1,
    competitionStage: 1,
    schedulePhase: 'elimination',
    round: 1,
    roundsUntilFinal: 1,
    sideA: feederMatchId
      ? { kind: 'hint', label: 'Winner', source: { matchId: feederMatchId, outcome: 'winner' } }
      : { kind: 'athlete', entryId: 'a1', displayName: 'A', clubName: 'C', city: 'X', publicNumber: 1 },
    sideB: { kind: 'athlete', entryId: 'a2', displayName: 'B', clubName: 'C', city: 'X', publicNumber: 2 },
  }
}

describe('resolveDownstreamBoutIds', () => {
  it('returns transitive downstream bouts', () => {
    const bouts = [bout('cat-1::m1'), bout('cat-1::m2', 'm1'), bout('cat-1::m3', 'm2')]
    expect(resolveDownstreamBoutIds('cat-1::m1', bouts)).toEqual(['cat-1::m2', 'cat-1::m3'])
  })
})
