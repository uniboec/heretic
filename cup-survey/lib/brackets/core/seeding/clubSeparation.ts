import type { BracketParticipantInput } from '../types'

export interface ClubSeparationReport {
  conflicts: number
  pairs: Array<{ entryIdA: string; entryIdB: string }>
  optimal: boolean
}

export function bracketSizeForN(n: number): number {
  let b = 2
  while (b < n) b *= 2
  return Math.min(b, 32)
}

/** Standard single-elimination seed order for bracket size B. */
export function seedOrderForBracketSize(b: number): number[] {
  if (b === 1) return [1]
  const half = seedOrderForBracketSize(b / 2)
  const result: number[] = []
  for (const s of half) {
    result.push(s)
    result.push(b + 1 - s)
  }
  return result
}

/** First-round seed pairings for bracket size B. */
export function firstRoundSeedPairs(b: number): Array<[number, number]> {
  const order = seedOrderForBracketSize(b)
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < order.length; i += 2) {
    pairs.push([order[i], order[i + 1]])
  }
  return pairs
}

function countConflicts(
  assignment: Map<number, BracketParticipantInput>,
  pairs: Array<[number, number]>,
  n: number,
): number {
  let conflicts = 0
  for (const [a, b] of pairs) {
    if (a > n || b > n) continue
    const pa = assignment.get(a)
    const pb = assignment.get(b)
    if (pa && pb && pa.clubIdentity === pb.clubIdentity) conflicts++
  }
  return conflicts
}

/**
 * Assign unlocked participants to seed positions minimizing same-club first-round matchups.
 * Locked positions are fixed. Uses branch-and-bound with pruning.
 */
export function separateClubsExact(
  participants: BracketParticipantInput[],
  drawSeed: string,
  lockedPositions: Map<number, string>,
): { participants: BracketParticipantInput[]; report: ClubSeparationReport } {
  const n = participants.length
  const b = bracketSizeForN(n)
  const pairs = firstRoundSeedPairs(b)

  const byId = new Map(participants.map((p) => [p.entryId, p]))
  const assignment = new Map<number, BracketParticipantInput>()

  for (const [pos, entryId] of lockedPositions) {
    const p = byId.get(entryId)
    if (p) assignment.set(pos, p)
  }

  const lockedIds = new Set(lockedPositions.values())
  const unlocked = participants.filter((p) => !lockedIds.has(p.entryId))
  const unlockedPositions = Array.from({ length: n }, (_, i) => i + 1).filter(
    (pos) => !lockedPositions.has(pos),
  )

  let bestAssignment = new Map(assignment)
  let bestConflicts =
    bestAssignment.size === n ? countConflicts(bestAssignment, pairs, n) : Number.POSITIVE_INFINITY

  function bound(conflicts: number, remaining: number): number {
    return conflicts
  }

  function search(
    idx: number,
    current: Map<number, BracketParticipantInput>,
    conflicts: number,
  ): void {
    if (idx >= unlocked.length) {
      if (current.size < n) return
      if (conflicts < bestConflicts || bestAssignment.size < n) {
        bestConflicts = conflicts
        bestAssignment = new Map(current)
      }
      return
    }

    if (conflicts >= bestConflicts) return

    const participant = unlocked[idx]
    for (const pos of unlockedPositions) {
      if (current.has(pos)) continue

      let added = 0
      for (const [a, bv] of pairs) {
        if (a === pos && bv <= n) {
          const opp = current.get(bv)
          if (opp && opp.clubIdentity === participant.clubIdentity) added++
        } else if (bv === pos && a <= n) {
          const opp = current.get(a)
          if (opp && opp.clubIdentity === participant.clubIdentity) added++
        }
      }

      const nextConflicts = conflicts + added
      if (bound(nextConflicts, unlocked.length - idx - 1) >= bestConflicts) continue

      current.set(pos, participant)
      search(idx + 1, current, nextConflicts)
      current.delete(pos)
    }
  }

  search(0, new Map(assignment), countConflicts(assignment, pairs, n))

  const result: BracketParticipantInput[] = []
  for (let pos = 1; pos <= n; pos++) {
    const p = bestAssignment.get(pos)
    if (p) result.push({ ...p, seedPosition: pos })
  }

  const conflictPairs: Array<{ entryIdA: string; entryIdB: string }> = []
  for (const [a, bv] of pairs) {
    if (a > n || bv > n) continue
    const pa = bestAssignment.get(a)
    const pb = bestAssignment.get(bv)
    if (pa && pb && pa.clubIdentity === pb.clubIdentity) {
      conflictPairs.push({ entryIdA: pa.entryId, entryIdB: pb.entryId })
    }
  }

  return {
    participants: result.sort((x, y) => x.seedPosition - y.seedPosition),
    report: {
      conflicts: bestConflicts,
      pairs: conflictPairs,
      optimal: true,
    },
  }
}
