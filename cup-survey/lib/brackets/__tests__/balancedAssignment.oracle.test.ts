import { describe, expect, it } from 'vitest'
import { assignBalancedDraw } from '../core/seeding/balancedAssignment'
import { compareSemantic, scoreAssignment } from '../core/seeding/scoreAssignment'
import type { BracketParticipantInput } from '../core/types'

function bruteForceBest(
  participants: BracketParticipantInput[],
  drawSeed: string,
  lockedPositions: Map<number, string>,
) {
  const lockedIds = new Set(lockedPositions.values())
  const unlocked = participants.filter((participant) => !lockedIds.has(participant.entryId))
  const positions = Array.from({ length: participants.length }, (_, index) => index + 1).filter(
    (position) => !lockedPositions.has(position),
  )

  let bestScore: ReturnType<typeof scoreAssignment> | null = null
  const visit = (depth: number, assignment: Map<number, BracketParticipantInput>, remaining: number[]) => {
    if (depth === unlocked.length) {
      const scored = scoreAssignment(
        [...assignment.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([drawPosition, participant]) => ({
            entryId: participant.entryId,
            strengthTier: participant.strengthTier ?? null,
            clubKey: participant.clubKey ?? null,
            cityKey: participant.cityKey ?? null,
            drawPosition,
            seedLocked: participant.seedLocked,
          })),
      )
      if (!bestScore || compareSemantic(scored, bestScore) < 0) {
        bestScore = scored
      }
      return
    }
    const participant = unlocked[depth]
    for (let index = 0; index < remaining.length; index++) {
      const position = remaining[index]
      assignment.set(position, participant)
      visit(depth + 1, assignment, remaining.filter((_, i) => i !== index))
      assignment.delete(position)
    }
  }

  const assignment = new Map<number, BracketParticipantInput>()
  for (const [position, entryId] of lockedPositions) {
    const participant = participants.find((item) => item.entryId === entryId)
    if (participant) assignment.set(position, participant)
  }
  visit(0, assignment, positions)
  return bestScore
}

function fixture(
  count: number,
  clubKey: string | null,
  startIndex = 1,
): BracketParticipantInput[] {
  return Array.from({ length: count }, (_, index) => {
    const position = startIndex + index
    return {
      entryId: `e${position}`,
      displayName: `Athlete ${position}`,
      clubName: clubKey ? `Club ${clubKey}` : '',
      city: 'City',
      clubIdentity: clubKey ? `Club ${clubKey}::City` : '',
      publicNumber: position,
      seedPosition: position,
      seedLocked: false,
      strengthTier: null,
      clubKey,
      cityKey: 'city',
    }
  })
}

describe('balancedAssignment oracle', () => {
  it('matches brute force for B=8 with reduced search space', () => {
    const participants = [
      ...fixture(2, 'club-a', 1),
      ...fixture(2, 'club-b', 3),
      ...fixture(2, 'club-c', 5),
      ...fixture(2, 'club-d', 7),
    ]
    const lockedPositions = new Map<number, string>([
      [1, 'e1'],
      [2, 'e2'],
      [3, 'e3'],
      [4, 'e4'],
      [5, 'e5'],
      [6, 'e6'],
    ])
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'oracle-b8',
      lockedPositions,
      maxSearchNodes: 1_000_000,
    })
    const brute = bruteForceBest(participants, 'oracle-b8', lockedPositions)
    const actual = scoreAssignment(
      result.participants.map((participant) => ({
        entryId: participant.entryId,
        strengthTier: participant.strengthTier ?? null,
        clubKey: participant.clubKey ?? null,
        cityKey: participant.cityKey ?? null,
        drawPosition: participant.seedPosition,
        seedLocked: participant.seedLocked,
      })),
    )
    expect(compareSemantic(actual, brute!)).toBe(0)
    expect(result.searchOptimal).toBe(true)
  })

  it('matches brute force for B=4', () => {
    const participants = [
      ...fixture(2, 'club-a', 1),
      ...fixture(2, 'club-b', 3),
    ]
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'oracle-b4',
      lockedPositions: new Map(),
      maxSearchNodes: 1_000_000,
    })
    const brute = bruteForceBest(participants, 'oracle-b4', new Map())
    const actual = scoreAssignment(
      result.participants.map((participant) => ({
        entryId: participant.entryId,
        strengthTier: participant.strengthTier ?? null,
        clubKey: participant.clubKey ?? null,
        cityKey: participant.cityKey ?? null,
        drawPosition: participant.seedPosition,
        seedLocked: participant.seedLocked,
      })),
    )
    expect(compareSemantic(actual, brute!)).toBe(0)
    expect(result.searchOptimal).toBe(true)
  })
})
