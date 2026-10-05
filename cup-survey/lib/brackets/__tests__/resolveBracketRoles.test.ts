import { describe, expect, it } from 'vitest'
import { patchStructureWithBoutResult } from '../applyResult/patchPublishedStructure'
import { deriveCategoryPlacements } from '../deriveCategoryPlacements'
import { resolveThreeWayRoles } from '../resolveBracketRoles'
import { buildThreeWayV1 } from '../systems/three-way/v1/build'
import type { BracketDrawParticipant } from '@prisma/client'

const participants4 = [
  {
    entryId: 'a1',
    displayName: 'A1',
    clubName: 'C',
    city: 'X',
    clubIdentity: 'c',
    publicNumber: 1,
    seedPosition: 1,
    seedLocked: false,
  },
  {
    entryId: 'a2',
    displayName: 'A2',
    clubName: 'C',
    city: 'X',
    clubIdentity: 'c',
    publicNumber: 2,
    seedPosition: 2,
    seedLocked: false,
  },
  {
    entryId: 'a3',
    displayName: 'A3',
    clubName: 'C',
    city: 'X',
    clubIdentity: 'c',
    publicNumber: 3,
    seedPosition: 3,
    seedLocked: false,
  },
]

const drawParticipants: BracketDrawParticipant[] = participants4.map((participant, index) => ({
  id: `p-${index + 1}`,
  drawId: 'draw-1',
  entryId: participant.entryId,
  seedPosition: participant.seedPosition,
  seedLocked: participant.seedLocked,
  snapshotDisplayName: participant.displayName,
  snapshotClubName: participant.clubName,
  snapshotCity: participant.city,
  snapshotPublicNumber: participant.publicNumber,
}))

describe('resolveThreeWayRoles', () => {
  it('resolves final and bronze source after bout results fill participants', () => {
    let structure = buildThreeWayV1({
      participants: participants4,
      drawSeed: 's',
      options: { bronzeMode: null },
    })

    for (const [boutId, winner, loser] of [
      ['cat::bout-1', 'a1', 'a2'],
      ['cat::bout-2', 'a1', 'a3'],
      ['cat::bout-3', 'a1', 'a2'],
    ] as const) {
      structure = patchStructureWithBoutResult({
        structure,
        boutId,
        winnerEntryId: winner,
        loserEntryId: loser,
        participants: drawParticipants,
        systemId: 'three_way',
        bronzeMode: null,
        participantCount: 3,
      }).structure
    }

    const roles = resolveThreeWayRoles(structure)
    expect(roles.finalMatch?.id).toBe('bout-3')
    expect(roles.bronzeSourceMatchId).toBe('bout-2')

    const result = deriveCategoryPlacements(structure, {
      systemId: 'three_way',
      bronzeMode: null,
      participantCount: 3,
    })
    expect(result.status).toBe('complete')
    expect(result.placements.map((placement) => placement.placement)).toEqual([1, 2, 3])
    expect(result.placements[2]?.entryId).toBe('a3')
  })

  it('resolves final and bronze when slotSource fields are null on prod snapshots', () => {
    let structure = buildThreeWayV1({
      participants: participants4,
      drawSeed: 's',
      options: { bronzeMode: null },
    })

    for (const [boutId, winner, loser] of [
      ['cat::bout-1', 'a1', 'a2'],
      ['cat::bout-2', 'a1', 'a3'],
      ['cat::bout-3', 'a1', 'a2'],
    ] as const) {
      structure = patchStructureWithBoutResult({
        structure,
        boutId,
        winnerEntryId: winner,
        loserEntryId: loser,
        participants: drawParticipants,
        systemId: 'three_way',
        bronzeMode: null,
        participantCount: 3,
      }).structure
    }

    const prodLike = {
      ...structure,
      rounds: structure.rounds.map((match) => ({
        ...match,
        slotSourceA: null,
        slotSourceB: null,
      })),
      bronzeSlots: structure.bronzeSlots?.map((slot) => ({
        ...slot,
        sourceA: null,
        sourceB: null,
      })),
    }

    const roles = resolveThreeWayRoles(prodLike)
    expect(roles.finalMatch?.id).toBe('bout-3')
    expect(roles.bronzeSourceMatchId).toBe('bout-2')

    const result = deriveCategoryPlacements(prodLike, {
      systemId: 'three_way',
      bronzeMode: null,
      participantCount: 3,
    })
    expect(result.status).toBe('complete')
    expect(result.placements.map((placement) => placement.placement)).toEqual([1, 2, 3])
  })
})
