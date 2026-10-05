import { compareStrengthTiersDesc } from './strengthTier'
import { earliestMeetingRound, idealEarliestRound } from './bracketRegions'
import { bracketSizeForN } from './clubSeparation'

export interface DrawAssignmentParticipant {
  entryId: string
  strengthTier: number | null
  clubKey: string | null
  cityKey: string | null
  drawPosition: number
  seedLocked: boolean
}

export type SemanticScore = [
  number,
  number[],
  ...number[][],
  number[],
]

function buildConflictVector(
  pairs: Array<{ posA: number; posB: number }>,
  bracketSize: number,
): number[] {
  const rounds = Math.log2(bracketSize)
  const vector = Array.from({ length: rounds }, () => 0)
  for (const { posA, posB } of pairs) {
    const roundIndex = earliestMeetingRound(posA, posB, bracketSize) - 1
    vector[roundIndex] += 1
  }
  return vector
}

function addVectors(a: number[], b: number[]): number[] {
  const length = Math.max(a.length, b.length)
  const result = Array.from({ length }, (_, index) => (a[index] ?? 0) + (b[index] ?? 0))
  return result
}

function pairsForKey(
  assignment: DrawAssignmentParticipant[],
  keySelector: (participant: DrawAssignmentParticipant) => string | null,
): Array<{ posA: number; posB: number }> {
  const groups = new Map<string, number[]>()
  for (const participant of assignment) {
    const key = keySelector(participant)
    if (!key) continue
    const positions = groups.get(key) ?? []
    positions.push(participant.drawPosition)
    groups.set(key, positions)
  }

  const pairs: Array<{ posA: number; posB: number }> = []
  for (const positions of groups.values()) {
    if (positions.length < 2) continue
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        pairs.push({ posA: positions[i], posB: positions[j] })
      }
    }
  }
  return pairs
}

export function buildEarlyConflictVector(
  pairs: Array<{ posA: number; posB: number }>,
  bracketSize: number,
  groupSize: number,
): number[] {
  const ideal = idealEarliestRound(bracketSize, groupSize)
  const earlyPairs = pairs.filter(
    ({ posA, posB }) => earliestMeetingRound(posA, posB, bracketSize) < ideal,
  )
  return buildConflictVector(earlyPairs, bracketSize)
}

export function scoreAssignment(
  assignment: DrawAssignmentParticipant[],
  lockedViolations = 0,
): SemanticScore {
  const participantCount = assignment.length
  const bracketSize = bracketSizeForN(participantCount)

  const clubVector = buildConflictVector(
    pairsForKey(assignment, (participant) => participant.clubKey),
    bracketSize,
  )

  const tiers = [
    ...new Set(
      assignment
        .map((participant) => participant.strengthTier)
        .filter((tier): tier is number => tier != null),
    ),
  ].sort(compareStrengthTiersDesc)

  const strengthVectors = tiers.map((tier) => {
    const positions = assignment
      .filter((participant) => participant.strengthTier === tier)
      .map((participant) => participant.drawPosition)
    const pairs: Array<{ posA: number; posB: number }> = []
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        pairs.push({ posA: positions[i], posB: positions[j] })
      }
    }
    return buildConflictVector(pairs, bracketSize)
  })

  const cityVector = buildConflictVector(
    pairsForKey(assignment, (participant) => participant.cityKey),
    bracketSize,
  )

  return [lockedViolations, clubVector, ...strengthVectors, cityVector]
}

export function compareSemantic(a: SemanticScore, b: SemanticScore): number {
  const maxLength = Math.max(a.length, b.length)
  for (let index = 0; index < maxLength; index++) {
    const left = a[index]
    const right = b[index]
    if (left === right) continue
    if (Array.isArray(left) && Array.isArray(right)) {
      const vectorLength = Math.max(left.length, right.length)
      for (let vectorIndex = 0; vectorIndex < vectorLength; vectorIndex++) {
        const lv = left[vectorIndex] ?? 0
        const rv = right[vectorIndex] ?? 0
        if (lv !== rv) return lv - rv
      }
      continue
    }
    if (typeof left === 'number' && typeof right === 'number') {
      return left - right
    }
  }
  return 0
}

export function minSemantic(a: SemanticScore, b: SemanticScore): SemanticScore {
  return compareSemantic(a, b) <= 0 ? a : b
}
