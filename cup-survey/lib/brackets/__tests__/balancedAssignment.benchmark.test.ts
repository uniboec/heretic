import { describe, expect, it } from 'vitest'
import { assignBalancedDraw } from '../core/seeding/balancedAssignment'
import type { BracketParticipantInput } from '../core/types'

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

describe('balancedAssignment benchmark', () => {
  for (const count of [8, 16] as const) {
    it(`completes draw for N=${count}`, () => {
      const result = assignBalancedDraw({
        participants: buildParticipants(count),
        drawSeed: `benchmark-n${count}`,
        lockedPositions: new Map(),
        maxSearchNodes: 300_000,
      })

      expect(result.participants).toHaveLength(count)
      expect(result.searchStats.searchNodes).toBeGreaterThan(0)
      expect(result.searchStats.elapsedMs).toBeGreaterThanOrEqual(0)
      expect(result.report.currentPotentialMeetings.length).toBeGreaterThanOrEqual(0)
    })
  }

  it('completes draw for N=32 with bounded search fallback', { timeout: 30_000 }, () => {
    const result = assignBalancedDraw({
      participants: buildParticipants(32),
      drawSeed: 'benchmark-n32',
      lockedPositions: new Map(),
      maxSearchNodes: 2_000,
    })

    expect(result.participants).toHaveLength(32)
    expect(result.searchStats.searchNodes).toBeGreaterThan(0)
    expect(result.searchStats.elapsedMs).toBeGreaterThanOrEqual(0)
  })
})
