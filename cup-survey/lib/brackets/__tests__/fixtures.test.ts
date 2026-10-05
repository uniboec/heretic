import { describe, expect, it } from 'vitest'
import { olympicV1Fixtures } from '../systems/olympic/v1/fixtures'
import { roundRobinV1Fixtures } from '../systems/round-robin/v1/fixtures'
import { threeWayV1Fixtures } from '../systems/three-way/v1/fixtures'
import '../systems'

describe('golden fixtures', () => {
  it('olympic v1 builds 8-participant bracket', () => {
    const structure = olympicV1Fixtures.eightParticipants()
    expect(structure.systemId).toBe('olympic')
    expect(structure.systemVersion).toBe(1)
    expect(structure.rounds.filter((r) => r.round === 1).length).toBe(4)
    expect(structure.bronzeSlots).toHaveLength(2)
  })

  it('round robin v1 builds 4-participant schedule', () => {
    const structure = roundRobinV1Fixtures.fourParticipants()
    expect(structure.roundRobinPairs?.length).toBe(6)
  })

  it('three_way v1 builds 3-participant bracket', () => {
    const structure = threeWayV1Fixtures.threeParticipants()
    expect(structure.systemId).toBe('three_way')
    expect(structure.rounds).toHaveLength(3)
  })
})
