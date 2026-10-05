import { describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../systems/olympic/v1/build'
import { buildThreeWayV1 } from '../systems/three-way/v1/build'
import type { BracketParticipantInput, BracketRoundMatch } from '../core/types'
import { patchStructureWithBoutResult } from '../applyResult/patchPublishedStructure'
import {
  getSemifinalMatches,
  resolveBronzeSingleAthlete,
} from '../resolveBronzeSlotAthlete'

function participants(n: number): BracketParticipantInput[] {
  return Array.from({ length: n }, (_, index) => ({
    entryId: `e${index}`,
    displayName: `Athlete ${index}`,
    clubName: 'Club',
    city: 'City',
    clubIdentity: 'Club::City',
    publicNumber: index + 1,
    seedPosition: index + 1,
    seedLocked: false,
  }))
}

function participantRows(n: number) {
  return participants(n).map((participant, index) => ({
    entryId: participant.entryId,
    snapshotDisplayName: participant.displayName,
    snapshotClubName: participant.clubName,
    snapshotCity: participant.city,
    snapshotPublicNumber: participant.publicNumber,
    seedPosition: participant.seedPosition,
    seedLocked: false,
    drawId: 'draw-1',
    id: `p${index}`,
  }))
}

describe('resolveBronzeSingleAthlete', () => {
  it('resolves third-place athlete from entryIdA', () => {
    const byEntry = new Map([['e2', { displayName: 'Athlete 2' }]])
    const result = resolveBronzeSingleAthlete(
      {
        id: 'third-place',
        label: 'Проигравший боя 2',
        entryIdA: 'e2',
        hintA: 'Athlete 2',
      },
      byEntry,
      {},
    )
    expect(result).toEqual({ label: 'Athlete 2', entryId: 'e2', pendingHint: false })
  })

  it('resolves olympic TWO bronze slots from semifinal losers', () => {
    let structure = buildOlympicV1({
      participants: participants(8),
      drawSeed: 'seed',
      options: { bronzeMode: 'TWO' },
    })
    const semis = getSemifinalMatches(structure.rounds)
    expect(semis).toHaveLength(2)

    for (const [index, semi] of semis.entries()) {
      const loserId = `loser-${index}`
      const patched = patchStructureWithBoutResult({
        structure,
        boutId: `cat::${semi.id}`,
        winnerEntryId: `winner-${index}`,
        loserEntryId: loserId,
        participants: [
          {
            entryId: loserId,
            snapshotDisplayName: `Loser ${index + 1}`,
            snapshotClubName: 'Club',
            snapshotCity: 'City',
            snapshotPublicNumber: index + 1,
            seedPosition: index + 1,
            seedLocked: false,
            drawId: 'draw-1',
            id: `pl${index}`,
          },
        ],
        systemId: 'olympic',
        bronzeMode: 'TWO',
        participantCount: 8,
      })
      structure = patched.structure
    }

    const byEntry = new Map([
      ['loser-0', { displayName: 'Loser 1' }],
      ['loser-1', { displayName: 'Loser 2' }],
    ])

    const slotA = structure.bronzeSlots?.[0]
    const slotB = structure.bronzeSlots?.[1]
    expect(slotA?.id).toBe('bronze-1')
    expect(slotB?.id).toBe('bronze-2')

    expect(
      resolveBronzeSingleAthlete(slotA!, byEntry, { rounds: structure.rounds }),
    ).toEqual({ label: 'Loser 1', entryId: 'loser-0', pendingHint: false })
    expect(
      resolveBronzeSingleAthlete(slotB!, byEntry, { rounds: structure.rounds }),
    ).toEqual({ label: 'Loser 2', entryId: 'loser-1', pendingHint: false })
  })

  it('resolves three-way third place from bout-2 loser after patch', () => {
    let structure = buildThreeWayV1({
      participants: participants(3),
      drawSeed: 'seed',
      options: { bronzeMode: null },
    })

    const patched = patchStructureWithBoutResult({
      structure,
      boutId: 'cat::bout-2',
      winnerEntryId: 'e2',
      loserEntryId: 'e1',
      participants: participantRows(3),
      systemId: 'three_way',
      bronzeMode: null,
      participantCount: 3,
    })
    structure = patched.structure

    const slot = structure.bronzeSlots?.[0]
    expect(slot?.entryIdA).toBe('e1')

    const byEntry = new Map(participants(3).map((p) => [p.entryId, { displayName: p.displayName }]))
    expect(resolveBronzeSingleAthlete(slot!, byEntry, { rounds: structure.rounds })).toEqual({
      label: 'Athlete 1',
      entryId: 'e1',
      pendingHint: false,
    })
  })

  it('falls back to condition label before semifinals finish', () => {
    const structure = buildOlympicV1({
      participants: participants(8),
      drawSeed: 'seed',
      options: { bronzeMode: 'TWO' },
    })
    const slot = structure.bronzeSlots?.[0]
    const result = resolveBronzeSingleAthlete(slot!, new Map(), { rounds: structure.rounds })
    expect(result.pendingHint).toBe(true)
    expect(result.label).toContain('Проигравший')
    expect(result.entryId).toBeNull()
  })
})
