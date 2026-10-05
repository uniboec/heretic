import { describe, expect, it } from 'vitest'
import { patchStructureWithBoutResult } from '../patchPublishedStructure'
import type { BracketStructure } from '../../core/types'

const structure: BracketStructure = {
  systemId: 'olympic',
  systemVersion: 1,
  rounds: [
    {
      id: 'bout-1',
      round: 1,
      slot: 1,
      matchNumber: 1,
      participantA: {
        entryId: 'a1',
        displayName: 'A1',
        clubName: 'Club',
        city: 'City',
        clubIdentity: 'club',
        publicNumber: 1,
        seedPosition: 1,
        seedLocked: false,
      },
      participantB: {
        entryId: 'b1',
        displayName: 'B1',
        clubName: 'Club',
        city: 'City',
        clubIdentity: 'club',
        publicNumber: 2,
        seedPosition: 2,
        seedLocked: false,
      },
    },
    {
      id: 'bout-2',
      round: 2,
      slot: 1,
      matchNumber: 2,
      participantA: null,
      participantB: null,
      slotSourceA: { matchId: 'bout-1', outcome: 'winner' },
      slotHintA: 'Победитель боя 1',
    },
  ],
}

describe('patchPublishedStructure', () => {
  it('fills downstream slot from bout result', () => {
    const { structure: patched, changed } = patchStructureWithBoutResult({
      structure,
      boutId: 'cat::bout-1',
      winnerEntryId: 'a1',
      loserEntryId: 'b1',
      participants: [
        {
          entryId: 'a1',
          snapshotDisplayName: 'A1',
          snapshotClubName: 'Club',
          snapshotCity: 'City',
          snapshotPublicNumber: 1,
          seedPosition: 1,
          seedLocked: false,
          drawId: 'draw-1',
          id: 'p1',
        },
      ],
      systemId: 'olympic',
      bronzeMode: null,
      participantCount: 2,
    })

    expect(changed).toBe(true)
    expect(patched.rounds[0]?.winnerEntryId).toBe('a1')
    expect(patched.rounds[0]?.loserEntryId).toBe('b1')
    expect(patched.rounds[1]?.participantA?.entryId).toBe('a1')
    expect(patched.rounds[1]?.slotSourceA).toBeUndefined()
    expect(patched.result?.status).toBe('in_progress')
  })

  it('fills bronze slot from completed bout', () => {
    const bronzeStructure: BracketStructure = {
      systemId: 'olympic',
      systemVersion: 1,
      rounds: [],
      bronzeSlots: [
        {
          id: 'bronze-1',
          label: 'Бронза',
          hintA: 'Проигравший боя 1',
          hintB: 'Проигравший боя 2',
          sourceA: { matchId: 'bout-1', outcome: 'loser' },
          sourceB: { matchId: 'bout-2', outcome: 'loser' },
        },
      ],
    }

    const { structure: patched, changed } = patchStructureWithBoutResult({
      structure: bronzeStructure,
      boutId: 'cat::bout-1',
      winnerEntryId: 'a1',
      loserEntryId: 'b1',
      participants: [
        {
          entryId: 'b1',
          snapshotDisplayName: 'B1',
          snapshotClubName: 'Club',
          snapshotCity: 'City',
          snapshotPublicNumber: 2,
          seedPosition: 2,
          seedLocked: false,
          drawId: 'draw-1',
          id: 'p2',
        },
      ],
      systemId: 'olympic',
      bronzeMode: 'ONE',
      participantCount: 4,
    })

    expect(changed).toBe(true)
    expect(patched.bronzeSlots?.[0]?.hintA).toBe('B1')
    expect(patched.bronzeSlots?.[0]?.sourceA).toBeUndefined()
  })
})
