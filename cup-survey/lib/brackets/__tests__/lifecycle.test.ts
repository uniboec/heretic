import { describe, expect, it } from 'vitest'
import { shuffleWithSeed } from '../core/seeding/prng'
import type { BracketParticipantInput } from '../core/types'

function redrawUnlocked(participants: BracketParticipantInput[], seed: string) {
  const locked = participants.filter((p) => p.seedLocked)
  const unlocked = shuffleWithSeed(
    participants.filter((p) => !p.seedLocked),
    seed,
  )
  return [...locked, ...unlocked]
}

describe('REDRAW lifecycle', () => {
  it('preserves locked participants in set', () => {
    const participants: BracketParticipantInput[] = [
      {
        entryId: '1',
        displayName: 'A',
        clubName: 'C',
        city: 'X',
        clubIdentity: 'C::X',
        publicNumber: 1,
        seedPosition: 1,
        seedLocked: true,
      },
      {
        entryId: '2',
        displayName: 'B',
        clubName: 'D',
        city: 'Y',
        clubIdentity: 'D::Y',
        publicNumber: 2,
        seedPosition: 2,
        seedLocked: false,
      },
      {
        entryId: '3',
        displayName: 'C',
        clubName: 'E',
        city: 'Z',
        clubIdentity: 'E::Z',
        publicNumber: 3,
        seedPosition: 3,
        seedLocked: false,
      },
    ]
    const result = redrawUnlocked(participants, 'seed-1')
    expect(result.find((p) => p.entryId === '1')?.seedLocked).toBe(true)
    expect(result.filter((p) => p.seedLocked)).toHaveLength(1)
  })
})
