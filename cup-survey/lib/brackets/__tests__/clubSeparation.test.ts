import { describe, expect, it } from 'vitest'
import {
  bracketSizeForN,
  firstRoundSeedPairs,
  separateClubsExact,
} from '../core/seeding/clubSeparation'
import type { BracketParticipantInput } from '../core/types'

function makeParticipants(
  specs: Array<{ id: string; club: string; locked?: boolean; pos?: number }>,
): BracketParticipantInput[] {
  return specs.map((s, i) => ({
    entryId: s.id,
    displayName: s.id,
    clubName: s.club,
    city: 'City',
    clubIdentity: `${s.club}::City`,
    publicNumber: i + 1,
    seedPosition: s.pos ?? i + 1,
    seedLocked: s.locked ?? false,
  }))
}

describe('clubSeparation', () => {
  it('bracket sizes are powers of 2 up to 32', () => {
    expect(bracketSizeForN(2)).toBe(2)
    expect(bracketSizeForN(5)).toBe(8)
    expect(bracketSizeForN(20)).toBe(32)
  })

  it('returns all participants when N=2 and clubs differ', () => {
    const participants = makeParticipants([
      { id: 'a1', club: 'A' },
      { id: 'b1', club: 'B' },
    ])
    const { participants: result, report } = separateClubsExact(participants, 'seed', new Map())
    expect(result).toHaveLength(2)
    expect(report.conflicts).toBe(0)
  })

  it('minimizes same-club first-round pairs for small N', () => {
    const participants = makeParticipants([
      { id: 'a1', club: 'A' },
      { id: 'a2', club: 'A' },
      { id: 'b1', club: 'B' },
      { id: 'b2', club: 'B' },
    ])
    const locked = new Map<number, string>()
    const { report } = separateClubsExact(participants, 'seed', locked)
    expect(report.conflicts).toBe(0)
    expect(report.optimal).toBe(true)
  })

  it('respects locked positions', () => {
    const participants = makeParticipants([
      { id: 'a1', club: 'A', locked: true, pos: 1 },
      { id: 'a2', club: 'A' },
      { id: 'b1', club: 'B' },
      { id: 'b2', club: 'B' },
    ])
    const locked = new Map<number, string>([[1, 'a1']])
    const { participants: result } = separateClubsExact(participants, 'seed', locked)
    expect(result.find((p) => p.entryId === 'a1')?.seedPosition).toBe(1)
  })

  it('first round pairs cover bracket', () => {
    const pairs = firstRoundSeedPairs(8)
    expect(pairs.length).toBe(4)
  })
})
