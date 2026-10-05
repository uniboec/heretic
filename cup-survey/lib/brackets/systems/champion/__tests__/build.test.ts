import { describe, expect, it } from 'vitest'
import { buildChampionV1, validateChampionCategory } from '../v1/build'
import type { BracketParticipantInput } from '../../../core/types'

const participant: BracketParticipantInput = {
  entryId: 'e1',
  displayName: 'Иван Иванов',
  clubName: 'Club A',
  city: 'City',
  clubIdentity: 'Club A::City',
  publicNumber: 12,
  seedPosition: 1,
  seedLocked: false,
}

describe('champion v1 build', () => {
  it('builds canonical result for one participant', () => {
    const structure = buildChampionV1({
      participants: [participant],
      drawSeed: 'seed',
      options: { bronzeMode: null },
    })

    expect(structure.systemId).toBe('champion')
    expect(structure.rounds).toHaveLength(0)
    expect(structure.result).toEqual({
      status: 'complete',
      placements: [{ entryId: 'e1', placement: 1, reason: 'SINGLE_PARTICIPANT' }],
    })
    expect(structure.champion?.displayName).toBe('Иван Иванов')
  })

  it('validates only n=1', () => {
    expect(validateChampionCategory(1)).toHaveLength(0)
    expect(validateChampionCategory(2).some((issue) => issue.code === 'INVALID_PARTICIPANT_COUNT')).toBe(
      true,
    )
  })
})
