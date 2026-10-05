import { assignBalancedDraw } from '../lib/brackets/core/seeding/balancedAssignment'
import type { BracketParticipantInput } from '../lib/brackets/core/types'

function buildParticipants(count: number): BracketParticipantInput[] {
  const clubs = Math.max(2, Math.floor(count / 2))
  return Array.from({ length: count }, (_, index) => {
    const clubIndex = index % clubs
    const clubKey = `club-${clubIndex}`
    return {
      entryId: `e${index + 1}`,
      displayName: `Athlete ${index + 1}`,
      clubName: `Club ${clubIndex}`,
      city: `City ${index % 3}`,
      clubIdentity: `${clubKey}::City ${index % 3}`,
      publicNumber: index + 1,
      seedPosition: index + 1,
      seedLocked: false,
      strengthTier: index % 4 === 0 ? 5 : null,
      clubKey,
      cityKey: `city-${index % 3}`,
    }
  })
}

async function main() {
  for (const count of [8, 16, 32]) {
    const result = assignBalancedDraw({
      participants: buildParticipants(count),
      drawSeed: `benchmark-n${count}`,
      lockedPositions: new Map(),
    })
    console.log(
      JSON.stringify({
        participants: count,
        searchOptimal: result.searchOptimal,
        searchNodes: result.searchStats.searchNodes,
        maxSearchNodes: result.searchStats.maxSearchNodes,
        elapsedMs: result.searchStats.elapsedMs,
        usedGreedyCandidate: result.searchStats.usedGreedyCandidate,
      }),
    )
  }
}

void main()
