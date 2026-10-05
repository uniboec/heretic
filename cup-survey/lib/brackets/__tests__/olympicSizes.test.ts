import { describe, expect, it } from 'vitest'
import { olympicV1 } from '../systems/olympic/v1'
import '../systems'

function buildN(n: number) {
  const participants = Array.from({ length: n }, (_, i) => ({
    entryId: `e${i + 1}`,
    displayName: `Athlete ${i + 1}`,
    clubName: `Club ${(i % 4) + 1}`,
    city: 'City',
    clubIdentity: `Club ${(i % 4) + 1}::City`,
    publicNumber: i + 1,
    seedPosition: i + 1,
    seedLocked: false,
  }))
  return olympicV1.build({
    participants,
    drawSeed: 'fixture',
    options: { bronzeMode: n >= 4 ? 'TWO' : null },
  })
}

describe('olympic bracket sizes', () => {
  it('N=5 B=8 has one real R1 bout and three bye pairs', () => {
    const structure = buildN(5)
    const round1 = structure.rounds.filter((round) => round.round === 1)
    const realBouts = round1.filter(
      (match) => match.participantA != null && match.participantB != null,
    )
    const byeBouts = round1.filter(
      (match) => match.participantA == null || match.participantB == null,
    )
    expect(realBouts).toHaveLength(1)
    expect(byeBouts).toHaveLength(3)
  })

  const sizes = [2, 4, 8, 16, 32]
  for (const n of sizes) {
    it(`builds bracket for N=${n}`, () => {
      const structure = buildN(n)
      const round1 = structure.rounds.filter((r) => r.round === 1)
      expect(round1.length).toBe(n / 2)
    })
  }
})
