import { describe, expect, it } from 'vitest'
import { roundRobinV1Fixtures } from '../systems/round-robin/v1/fixtures'
import { buildRoundRobinV1 } from '../systems/round-robin/v1/build'
import type { BracketParticipantInput } from '../core/types'

function participant(seedPosition: number, entryId = `e${seedPosition}`): BracketParticipantInput {
  return {
    entryId,
    displayName: `Участник ${seedPosition}`,
    clubName: 'Клуб',
    city: 'Город',
    clubIdentity: `club-${seedPosition}`,
    publicNumber: seedPosition,
    seedPosition,
    seedLocked: false,
  }
}

describe('round_robin bout numbering', () => {
  it('assigns sequential match numbers for 3 participants', () => {
    const structure = buildRoundRobinV1({
      participants: [participant(1), participant(2), participant(3)],
      drawSeed: 'test',
      options: { bronzeMode: null },
    })
    const pairs = structure.roundRobinPairs ?? []
    expect(pairs).toHaveLength(3)
    expect(pairs.map((p) => p.matchNumber)).toEqual([1, 2, 3])
  })

  it('assigns sequential match numbers for 4 participants', () => {
    const structure = roundRobinV1Fixtures.fourParticipants()
    const pairs = structure.roundRobinPairs ?? []
    expect(pairs).toHaveLength(6)
    expect(pairs.map((p) => p.matchNumber)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
