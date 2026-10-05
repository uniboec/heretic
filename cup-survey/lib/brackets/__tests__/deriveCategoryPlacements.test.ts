import { describe, expect, it } from 'vitest'
import {
  deriveCategoryPlacements,
  structureWithDerivedResult,
  validatePlacements,
} from '../deriveCategoryPlacements'
import { buildChampionV1 } from '../systems/champion/v1/build'
import { buildOlympicV1 } from '../systems/olympic/v1/build'
import { buildThreeWayV1 } from '../systems/three-way/v1/build'
import { roundRobinV1 } from '../systems/round-robin/v1'
import { patchStructureWithBoutResult } from '../applyResult/patchPublishedStructure'
import type { BracketStructure } from '../core/types'

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
  {
    entryId: 'a4',
    displayName: 'A4',
    clubName: 'C',
    city: 'X',
    clubIdentity: 'c',
    publicNumber: 4,
    seedPosition: 4,
    seedLocked: false,
  },
]

describe('deriveCategoryPlacements', () => {
  it('champion is complete with placement 1', () => {
    const structure = buildChampionV1({
      participants: [participants4[0]],
      drawSeed: 's',
      options: { bronzeMode: null },
    })
    const result = deriveCategoryPlacements(structure, {
      systemId: 'champion',
      bronzeMode: null,
      participantCount: 1,
    })
    expect(result.status).toBe('complete')
    expect(result.placements).toEqual([
      { entryId: 'a1', placement: 1, reason: 'SINGLE_PARTICIPANT' },
    ])
  })

  it('olympic ONE is in_progress until final and bronze complete', () => {
    let structure = buildOlympicV1({
      participants: participants4,
      drawSeed: 's',
      options: { bronzeMode: 'ONE' },
    })

    const semi1 = structure.rounds.find((m) => m.id === 'bout-1')
    structure = patchStructureWithBoutResult({
      structure,
      boutId: 'cat::bout-1',
      winnerEntryId: 'a1',
      loserEntryId: 'a2',
      participants: [],
      systemId: 'olympic',
      bronzeMode: 'ONE',
      participantCount: 4,
    }).structure

    expect(deriveCategoryPlacements(structure, { systemId: 'olympic', bronzeMode: 'ONE' }).status).toBe(
      'in_progress',
    )
    expect(semi1).toBeDefined()
  })

  it('three-way roles do not depend on matchNumber labels', () => {
    const structure = buildThreeWayV1({
      participants: participants4.slice(0, 3),
      drawSeed: 's',
      options: { bronzeMode: null },
    })

    let patched = structure
    for (const [boutId, winner, loser] of [
      ['cat::bout-1', 'a1', 'a2'],
      ['cat::bout-2', 'a3', 'a2'],
      ['cat::bout-3', 'a1', 'a3'],
    ] as const) {
      patched = patchStructureWithBoutResult({
        structure: patched,
        boutId,
        winnerEntryId: winner,
        loserEntryId: loser,
        participants: [],
        systemId: 'three_way',
        bronzeMode: null,
        participantCount: 3,
      }).structure
    }

    const result = deriveCategoryPlacements(patched, {
      systemId: 'three_way',
      bronzeMode: null,
      participantCount: 3,
    })
    expect(result.status).toBe('complete')
    expect(result.placements.map((p) => p.placement)).toEqual([1, 2, 3])
    expect(result.placements[0]?.entryId).toBe('a1')
    expect(result.placements[2]?.entryId).toBe('a2')
  })

  describe('structureWithDerivedResult', () => {
    it('keeps stored complete result when derive would be broken', () => {
      let structure = buildThreeWayV1({
        participants: participants4.slice(0, 3),
        drawSeed: 's',
        options: { bronzeMode: null },
      })

      for (const [boutId, winner, loser] of [
        ['cat::bout-1', 'a1', 'a2'],
        ['cat::bout-2', 'a3', 'a2'],
        ['cat::bout-3', 'a1', 'a3'],
      ] as const) {
        structure = patchStructureWithBoutResult({
          structure,
          boutId,
          winnerEntryId: winner,
          loserEntryId: loser,
          participants: [],
          systemId: 'three_way',
          bronzeMode: null,
          participantCount: 3,
        }).structure
      }

      const stored = structure.result!
      const broken = {
        ...structure,
        rounds: structure.rounds.map((match) => ({
          ...match,
          slotSourceA: null,
          slotSourceB: null,
        })),
        result: stored,
      }

      const read = structureWithDerivedResult(broken, {
        systemId: 'three_way',
        bronzeMode: null,
        participantCount: 3,
      })

      expect(read.result).toEqual(stored)
      expect(read.result?.status).toBe('complete')
      expect(read.result?.placements).toHaveLength(3)
    })

    it('keeps stored complete result when derive would return a different podium', () => {
      let structure = buildOlympicV1({
        participants: participants4,
        drawSeed: 's',
        options: { bronzeMode: 'ONE' },
      })

      for (const [boutId, winner, loser] of [
        ['cat::bout-1', 'a1', 'a4'],
        ['cat::bout-2', 'a2', 'a3'],
        ['cat::bout-3', 'a1', 'a2'],
        ['cat::bout-4', 'a3', 'a4'],
      ] as const) {
        structure = patchStructureWithBoutResult({
          structure,
          boutId,
          winnerEntryId: winner,
          loserEntryId: loser,
          participants: [],
          systemId: 'olympic',
          bronzeMode: 'ONE',
          participantCount: 4,
        }).structure
      }

      const stored = {
        status: 'complete' as const,
        placements: [
          { entryId: 'a1', placement: 1, reason: 'FINAL_WINNER' as const },
          { entryId: 'a2', placement: 2, reason: 'FINAL_LOSER' as const },
          { entryId: 'a3', placement: 3, reason: 'BRONZE_ONE' as const },
        ],
      }

      const swapped = {
        ...structure,
        rounds: structure.rounds.map((match) =>
          match.id === 'bout-3'
            ? { ...match, winnerEntryId: 'a2', loserEntryId: 'a1' }
            : match,
        ),
        result: stored,
      }

      const read = structureWithDerivedResult(swapped, {
        systemId: 'olympic',
        bronzeMode: 'ONE',
        participantCount: 4,
      })

      expect(read.result).toEqual(stored)
    })
  })

  describe('placement invariants', () => {
    it('rejects duplicate entryIds', () => {
      expect(() =>
        validatePlacements(
          {
            status: 'complete',
            placements: [
              { entryId: 'a', placement: 1, reason: 'FINAL_WINNER' },
              { entryId: 'a', placement: 2, reason: 'FINAL_LOSER' },
            ],
          },
          { systemId: 'olympic', bronzeMode: 'ONE', participantCount: 4 },
        ),
      ).toThrow(/Duplicate/)
    })

    it('olympic TWO complete has 1,2,3,3', () => {
      validatePlacements(
        {
          status: 'complete',
          placements: [
            { entryId: 'a', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'b', placement: 2, reason: 'FINAL_LOSER' },
            { entryId: 'c', placement: 3, reason: 'BRONZE_TWO' },
            { entryId: 'd', placement: 3, reason: 'BRONZE_TWO' },
          ],
        },
        { systemId: 'olympic', bronzeMode: 'TWO', participantCount: 4 },
      )
    })

    it('round-robin N=2 complete has only 1,2', () => {
      const twoParticipants = participants4.slice(0, 2)
      let structure = roundRobinV1.build({
        participants: twoParticipants,
        drawSeed: 'rr-2',
        options: { bronzeMode: null },
      })
      const pair = structure.roundRobinPairs?.[0]
      expect(pair).toBeDefined()

      structure = patchStructureWithBoutResult({
        structure,
        boutId: `cat::rr-${pair!.matchNumber}`,
        winnerEntryId: 'a1',
        loserEntryId: 'a2',
        participants: [],
        systemId: 'round_robin',
        bronzeMode: null,
        participantCount: 2,
      }).structure

      const result = deriveCategoryPlacements(structure, {
        systemId: 'round_robin',
        bronzeMode: null,
        participantCount: 2,
      })
      expect(result.status).toBe('complete')
      validatePlacements(result, {
        systemId: 'round_robin',
        bronzeMode: null,
        participantCount: 2,
      })
      expect(result.placements.map((placement) => placement.placement)).toEqual([1, 2])
    })
  })
})
