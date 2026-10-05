import { describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../systems/olympic/v1/build'
import type { BracketParticipantInput } from '../core/types'

function participants(n: number): BracketParticipantInput[] {
  return Array.from({ length: n }, (_, i) => ({
    entryId: `e${i}`,
    displayName: `Athlete ${i}`,
    clubName: 'Club',
    city: 'City',
    clubIdentity: 'Club::City',
    publicNumber: i + 1,
    seedPosition: i + 1,
    seedLocked: false,
  }))
}

describe('olympic bronze structural refs', () => {
  it('ONE mode exposes single bronze fight slot', () => {
    const structure = buildOlympicV1({
      participants: participants(8),
      drawSeed: 'test-seed',
      options: { bronzeMode: 'ONE' },
    })
    expect(structure.bronzeSlots).toHaveLength(1)
    expect(structure.bronzeSlots?.[0].id).toBe('bronze-fight')
  })

  it('TWO mode exposes loser semifinal slots', () => {
    const structure = buildOlympicV1({
      participants: participants(8),
      drawSeed: 'test-seed',
      options: { bronzeMode: 'TWO' },
    })
    expect(structure.bronzeSlots).toHaveLength(2)
    expect(structure.bronzeSlots?.map((s) => s.id)).toEqual(['bronze-1', 'bronze-2'])
    expect(structure.bronzeSlots?.map((s) => s.label)).toEqual([
      'Проигравший боя 5',
      'Проигравший боя 6',
    ])
  })
})
