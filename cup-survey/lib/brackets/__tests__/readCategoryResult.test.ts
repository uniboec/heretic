import { describe, expect, it } from 'vitest'
import { patchStructureWithBoutResult } from '../applyResult/patchPublishedStructure'
import { readCategoryResult } from '../core/readCategoryResult'
import { buildChampionV1 } from '../systems/champion/v1/build'
import { buildThreeWayV1 } from '../systems/three-way/v1/build'
import type { BracketDrawParticipant } from '@prisma/client'

describe('readCategoryResult', () => {
  it('returns placements for champion structure', () => {
    const structure = buildChampionV1({
      participants: [
        {
          entryId: 'e1',
          displayName: 'Test',
          clubName: 'C',
          city: 'X',
          clubIdentity: 'C::X',
          publicNumber: null,
          seedPosition: 1,
          seedLocked: false,
        },
      ],
      drawSeed: 's',
      options: { bronzeMode: null },
    })

    expect(readCategoryResult(structure, 'champion')).toEqual(structure.result)
  })

  it('returns null when structure is missing', () => {
    expect(readCategoryResult(null, 'olympic')).toBeNull()
  })

  it('derives complete champion result when stored result omits status', () => {
    const structure = buildChampionV1({
      participants: [
        {
          entryId: 'e1',
          displayName: 'Test',
          clubName: 'C',
          city: 'X',
          clubIdentity: 'C::X',
          publicNumber: null,
          seedPosition: 1,
          seedLocked: false,
        },
      ],
      drawSeed: 's',
      options: { bronzeMode: null },
    })

    const malformed = {
      ...structure,
      result: {
        bouts: [],
        placements: structure.result?.placements ?? [],
      } as unknown as typeof structure.result,
    }

    expect(readCategoryResult(malformed, 'champion')).toMatchObject({
      status: 'complete',
      placements: [{ entryId: 'e1', placement: 1, reason: 'SINGLE_PARTICIPANT' }],
    })
  })

  it('re-derives complete three_way result when stored in_progress is empty', () => {
    const participants = [
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
    const drawParticipants: BracketDrawParticipant[] = participants.map((participant, index) => ({
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

    let structure = buildThreeWayV1({
      participants,
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

    const stale = {
      ...structure,
      result: { status: 'in_progress' as const, placements: [] },
    }

    expect(readCategoryResult(stale, 'three_way', { participantCount: 3 })).toMatchObject({
      status: 'complete',
      placements: [
        { entryId: 'a1', placement: 1 },
        { entryId: 'a2', placement: 2 },
        { entryId: 'a3', placement: 3 },
      ],
    })
  })

  it('returns result for olympic when embedded in structure', () => {
    expect(
      readCategoryResult(
        {
          systemId: 'olympic',
          systemVersion: 1,
          rounds: [],
          result: { status: 'in_progress', placements: [] },
        },
        'olympic',
      ),
    ).toEqual({ status: 'in_progress', placements: [] })
  })
})
