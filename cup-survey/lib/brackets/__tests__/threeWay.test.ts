import { describe, expect, it } from 'vitest'
import { threeWayV1Fixtures } from '../systems/three-way/v1/fixtures'
import { buildThreeWayV1, validateThreeWayCategory } from '../systems/three-way/v1/build'
import { BracketSystemRegistry } from '../core/registry'
import '../systems'

describe('three_way system', () => {
  it('is registered', () => {
    expect(BracketSystemRegistry.has('three_way', 1)).toBe(true)
  })

  it('builds three bouts with bye holder on seed 3', () => {
    const structure = threeWayV1Fixtures.threeParticipants()
    expect(structure.systemId).toBe('three_way')
    expect(structure.rounds).toHaveLength(3)
    expect(structure.rounds[0].participantA?.seedPosition).toBe(1)
    expect(structure.rounds[0].participantB?.seedPosition).toBe(2)
    expect(structure.rounds[1].participantB?.seedPosition).toBe(3)
    expect(structure.rounds[1].slotHintA).toBe('Проигравший боя 1')
    expect(structure.rounds[2].slotHintA).toBe('Победитель боя 1')
    expect(structure.rounds[2].slotHintB).toBe('Победитель боя 2')
    expect(structure.rounds[1].slotSourceA).toEqual({ matchId: 'bout-1', outcome: 'loser' })
    expect(structure.rounds[2].slotSourceA).toEqual({ matchId: 'bout-1', outcome: 'winner' })
    expect(structure.rounds[2].slotSourceB).toEqual({ matchId: 'bout-2', outcome: 'winner' })
    expect(structure.bronzeSlots?.[0]?.sourceA).toEqual({ matchId: 'bout-2', outcome: 'loser' })
    expect(structure.bronzeSlots).toHaveLength(1)
  })

  it('validates only for exactly 3 participants', () => {
    expect(validateThreeWayCategory(3)).toHaveLength(0)
    expect(validateThreeWayCategory(2).some((i) => i.code === 'INVALID_COUNT')).toBe(true)
    expect(validateThreeWayCategory(4).some((i) => i.code === 'INVALID_COUNT')).toBe(true)
  })

  it('requires fresh seeding', () => {
    const system = BracketSystemRegistry.getLatest('three_way')
    expect(system.requiresFreshSeeding).toBe(true)
    expect(system.maxParticipants).toBe(3)
  })

  it('does not support bronze modes', () => {
    const system = BracketSystemRegistry.getLatest('three_way')
    expect(system.supportedBronzeModes(3)).toBeNull()
  })

  it('build rejects fewer than 3 via validateCategory on system', () => {
    const system = BracketSystemRegistry.getLatest('three_way')
    const issues = system.validateCategory(2, { bronzeMode: null })
    expect(issues.length).toBeGreaterThan(0)
  })

  it('build handles sorted participants', () => {
    const structure = buildThreeWayV1({
      participants: [
        {
          entryId: 'c',
          displayName: 'C',
          clubName: 'Club',
          city: 'City',
          clubIdentity: 'club-c',
          publicNumber: 3,
          seedPosition: 3,
          seedLocked: false,
        },
        {
          entryId: 'a',
          displayName: 'A',
          clubName: 'Club',
          city: 'City',
          clubIdentity: 'club-a',
          publicNumber: 1,
          seedPosition: 1,
          seedLocked: false,
        },
        {
          entryId: 'b',
          displayName: 'B',
          clubName: 'Club',
          city: 'City',
          clubIdentity: 'club-b',
          publicNumber: 2,
          seedPosition: 2,
          seedLocked: false,
        },
      ],
      drawSeed: 'test',
      options: { bronzeMode: null },
    })
    expect(structure.rounds[1].participantB?.entryId).toBe('c')
  })
})
