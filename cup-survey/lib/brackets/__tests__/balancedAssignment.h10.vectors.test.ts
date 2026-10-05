import { describe, expect, it, vi } from 'vitest'
import { assignBalancedDraw } from '../core/seeding/balancedAssignment'
import { idealEarliestRound } from '../core/seeding/bracketRegions'
import { bracketSizeForN } from '../core/seeding/clubSeparation'
import {
  buildEarlyConflictVector,
  scoreAssignment,
  type DrawAssignmentParticipant,
} from '../core/seeding/scoreAssignment'
import type { BracketParticipantInput } from '../core/types'

function clubAssignment(
  bracketSize: number,
  clubPositions: number[],
): DrawAssignmentParticipant[] {
  return Array.from({ length: bracketSize }, (_, index) => {
    const drawPosition = index + 1
    const isClub = clubPositions.includes(drawPosition)
    return {
      entryId: `e${drawPosition}`,
      strengthTier: null,
      clubKey: isClub ? 'club-a' : `club-${drawPosition}`,
      cityKey: 'city',
      drawPosition,
      seedLocked: false,
    }
  })
}

describe('balanced draw H.10 vectors', () => {
  it('uses full club vector [0,0,0,1] with zero early vector for final-only meeting at B=16', () => {
    const bracketSize = 16
    const pairs = [{ posA: 1, posB: 2 }]
    const assignment = clubAssignment(bracketSize, [1, 2])
    const clubVector = scoreAssignment(assignment, 0)[1] as number[]
    expect(clubVector).toEqual([0, 0, 0, 1])
    expect(buildEarlyConflictVector(pairs, bracketSize, 2)).toEqual([0, 0, 0, 0])
    expect(idealEarliestRound(bracketSize, 2)).toBe(3)
  })

  it('warns when same-club athletes meet before ideal round', () => {
    const participants = Array.from({ length: 8 }, (_, index) => ({
      entryId: `e${index + 1}`,
      displayName: `Athlete ${index + 1}`,
      clubName: 'Club',
      city: 'City',
      clubIdentity: index < 2 ? 'club-a::City' : `club-${index}::City`,
      publicNumber: index + 1,
      seedPosition: index + 1,
      seedLocked: index < 2,
      strengthTier: null,
      clubKey: index < 2 ? 'club-a' : `club-${index}`,
      cityKey: 'city',
    }))
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-early-warning',
      lockedPositions: new Map([[1, 'e1'], [8, 'e2']]),
    })
    expect(result.report.currentEarlyConflicts.length).toBeGreaterThan(0)
  })

  it('does not treat searchOptimal as proof of minimal early conflicts', () => {
    const spreadEarly = buildEarlyConflictVector(
      [
        { posA: 1, posB: 8 },
        { posA: 1, posB: 4 },
        { posA: 1, posB: 5 },
        { posA: 8, posB: 4 },
        { posA: 8, posB: 5 },
        { posA: 4, posB: 5 },
      ],
      8,
      4,
    )
    const clusteredEarly = buildEarlyConflictVector(
      [
        { posA: 1, posB: 2 },
        { posA: 1, posB: 3 },
        { posA: 1, posB: 4 },
        { posA: 2, posB: 3 },
        { posA: 2, posB: 4 },
        { posA: 3, posB: 4 },
      ],
      8,
      4,
    )
    expect(spreadEarly.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(
      clusteredEarly.reduce((sum, value) => sum + value, 0),
    )
  })

  it('prefers lower early-conflict count for spread tier layout at B=8', () => {
    const spreadEarly = buildEarlyConflictVector(
      [
        { posA: 1, posB: 8 },
        { posA: 4, posB: 5 },
      ],
      8,
      4,
    )
    const clusteredEarly = buildEarlyConflictVector(
      [
        { posA: 1, posB: 2 },
        { posA: 2, posB: 3 },
        { posA: 3, posB: 4 },
      ],
      8,
      4,
    )
    expect(spreadEarly.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(
      clusteredEarly.reduce((sum, value) => sum + value, 0),
    )
  })

  it('canonicalizes participant order before draw', () => {
    const base = [
      {
        entryId: 'e2',
        displayName: 'B',
        clubName: 'Club B',
        city: 'City',
        clubIdentity: 'club-b::City',
        publicNumber: 2,
        seedPosition: 2,
        seedLocked: false,
        strengthTier: null,
        clubKey: 'club-b',
        cityKey: 'city',
      },
      {
        entryId: 'e1',
        displayName: 'A',
        clubName: 'Club A',
        city: 'City',
        clubIdentity: 'club-a::City',
        publicNumber: 1,
        seedPosition: 1,
        seedLocked: false,
        strengthTier: null,
        clubKey: 'club-a',
        cityKey: 'city',
      },
    ]
    const first = assignBalancedDraw({
      participants: base,
      drawSeed: 'h10-canonical',
      lockedPositions: new Map(),
    })
    const second = assignBalancedDraw({
      participants: [...base].reverse(),
      drawSeed: 'h10-canonical',
      lockedPositions: new Map(),
    })
    const serialize = (items: BracketParticipantInput[]) =>
      items
        .map((item) => `${item.entryId}:${item.seedPosition}`)
        .sort((a, b) => a.localeCompare(b))
        .join('|')
    expect(serialize(first.participants)).toBe(serialize(second.participants))
  })

  it('may differ across redraw revisions with tied semantic scores', () => {
    const participants = Array.from({ length: 8 }, (_, index) => ({
      entryId: `e${index + 1}`,
      displayName: `Athlete ${index + 1}`,
      clubName: `Club ${index % 4}`,
      city: 'City',
      clubIdentity: `club-${index % 4}::City`,
      publicNumber: index + 1,
      seedPosition: index + 1,
      seedLocked: false,
      strengthTier: index % 2 === 0 ? 5 : 1,
      clubKey: `club-${index % 4}`,
      cityKey: 'city',
    }))
    const revisionA = assignBalancedDraw({
      participants,
      drawSeed: 'category-key:0',
      lockedPositions: new Map(),
      maxSearchNodes: 200,
    })
    const revisionB = assignBalancedDraw({
      participants,
      drawSeed: 'category-key:1',
      lockedPositions: new Map(),
      maxSearchNodes: 200,
    })
    const serialize = (items: BracketParticipantInput[]) =>
      items.map((item) => `${item.entryId}:${item.seedPosition}`).join('|')
    expect(serialize(revisionA.participants)).not.toBe(serialize(revisionB.participants))
  })

  it('keeps best complete assignment when maxSearchNodes is hit', () => {
    const participants = Array.from({ length: 8 }, (_, index) => ({
      entryId: `e${index + 1}`,
      displayName: `Athlete ${index + 1}`,
      clubName: 'Club',
      city: 'City',
      clubIdentity: 'club-a::City',
      publicNumber: index + 1,
      seedPosition: index + 1,
      seedLocked: false,
      strengthTier: null,
      clubKey: 'club-a',
      cityKey: 'city',
    }))
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-min-semantic',
      lockedPositions: new Map(),
      maxSearchNodes: 40,
    })
    expect(result.searchOptimal).toBe(false)
    expect(result.participants).toHaveLength(8)
    expect(bracketSizeForN(8)).toBe(8)
    expect(result.searchStats.usedGreedyCandidate).toBe(true)
  })

  it('logs only when timeBudgetMs is exceeded', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    assignBalancedDraw({
      participants: Array.from({ length: 8 }, (_, index) => ({
        entryId: `e${index + 1}`,
        displayName: `Athlete ${index + 1}`,
        clubName: 'Club',
        city: 'City',
        clubIdentity: `club-${index}::City`,
        publicNumber: index + 1,
        seedPosition: index + 1,
        seedLocked: false,
        strengthTier: null,
        clubKey: `club-${index}`,
        cityKey: 'city',
      })),
      drawSeed: 'h10-time-budget',
      lockedPositions: new Map(),
      maxSearchNodes: 5_000,
      timeBudgetMs: 0,
    })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('time budget exceeded'),
    )
    warn.mockRestore()
  })
})
