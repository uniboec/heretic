import { describe, expect, it } from 'vitest'
import { assignBalancedDraw } from '../core/seeding/balancedAssignment'
import { idealEarliestRound } from '../core/seeding/bracketRegions'
import { bracketSizeForN } from '../core/seeding/clubSeparation'
import { compareSemantic, scoreAssignment } from '../core/seeding/scoreAssignment'
import type { BracketParticipantInput } from '../core/types'

function participant(
  index: number,
  overrides: Partial<BracketParticipantInput> = {},
): BracketParticipantInput {
  return {
    entryId: `e${index}`,
    displayName: `Athlete ${index}`,
    clubName: overrides.clubKey ? `Club ${overrides.clubKey}` : '',
    city: 'City',
    clubIdentity: overrides.clubKey ? `${overrides.clubKey}::City` : '',
    publicNumber: index,
    seedPosition: index,
    seedLocked: false,
    strengthTier: overrides.strengthTier ?? null,
    clubKey: overrides.clubKey ?? null,
    cityKey: overrides.cityKey ?? 'city',
    ...overrides,
  }
}

function clubGroup(count: number, clubKey: string, startIndex = 1): BracketParticipantInput[] {
  return Array.from({ length: count }, (_, offset) =>
    participant(startIndex + offset, { clubKey, seedPosition: startIndex + offset }),
  )
}

function toAssignment(participants: BracketParticipantInput[]) {
  return participants.map((item) => ({
    entryId: item.entryId,
    strengthTier: item.strengthTier ?? null,
    clubKey: item.clubKey ?? null,
    cityKey: item.cityKey ?? null,
    drawPosition: item.seedPosition,
    seedLocked: item.seedLocked,
  }))
}

describe('balanced draw H.10 extended', () => {
  it('spreads two clubs from same city when club separation allows', () => {
    const participants = [
      participant(1, { clubKey: 'club-a', cityKey: 'city-1' }),
      participant(2, { clubKey: 'club-b', cityKey: 'city-1' }),
      participant(3, { clubKey: 'club-c', cityKey: 'city-2' }),
      participant(4, { clubKey: 'club-d', cityKey: 'city-2' }),
    ]
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-city-spread',
      lockedPositions: new Map(),
    })
    expect(result.participants).toHaveLength(4)
    const sameCity = result.participants.filter((item) => item.cityKey === 'city-1')
    expect(sameCity.length).toBe(2)
  })

  it('completes 10/16 one-club draw with descriptive warnings', { timeout: 15_000 }, () => {
    const participants = [
      ...clubGroup(10, 'club-a', 1),
      ...clubGroup(1, 'club-b', 11),
      ...clubGroup(1, 'club-c', 12),
      ...clubGroup(1, 'club-d', 13),
      ...clubGroup(1, 'club-e', 14),
      ...clubGroup(1, 'club-f', 15),
      ...clubGroup(1, 'club-g', 16),
    ]
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-ten-sixteen',
      lockedPositions: new Map(),
      maxSearchNodes: 5_000,
    })
    expect(result.participants).toHaveLength(16)
    const clubA = result.report.clubSeparation.byClubKey.find((club) => club.clubKey === 'club-a')
    expect(clubA?.count).toBe(10)
    expect(result.report.summary.clubLines.length).toBeGreaterThan(0)
    if (result.searchOptimal) {
      expect(result.report.optimalLayoutMetrics).toBeDefined()
    }
  })

  it('reports no early warning when two clubmates meet only in final', () => {
    const bracketSize = 4
    const ideal = idealEarliestRound(bracketSize, 2)
    expect(ideal).toBe(1)
    const participants = clubGroup(2, 'club-a')
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-final-only',
      lockedPositions: new Map(),
    })
    const earlyClub = result.report.currentEarlyConflicts.filter((item) => item.kind === 'club')
    expect(earlyClub).toHaveLength(0)
  })

  it('falls back deterministically when maxSearchNodes is exhausted', () => {
    const participants = clubGroup(8, 'club-a', 1)
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-node-limit',
      lockedPositions: new Map(),
      maxSearchNodes: 50,
    })
    expect(result.searchOptimal).toBe(false)
    expect(result.searchStats.searchNodes).toBeGreaterThanOrEqual(50)
    expect(result.participants).toHaveLength(8)
    expect(result.report.optimalLayoutMetrics).toBeUndefined()
  })

  it('may change assignment when drawSeed changes at same revision semantics', () => {
    const participants = [
      ...clubGroup(2, 'club-a', 1),
      ...clubGroup(2, 'club-b', 3),
      ...clubGroup(2, 'club-c', 5),
      ...clubGroup(2, 'club-d', 7),
    ]
    const first = assignBalancedDraw({
      participants,
      drawSeed: 'h10-revision-a',
      lockedPositions: new Map(),
      maxSearchNodes: 10,
    })
    const second = assignBalancedDraw({
      participants,
      drawSeed: 'h10-revision-b',
      lockedPositions: new Map(),
      maxSearchNodes: 10,
    })
    expect(first.searchOptimal).toBe(false)
    expect(second.searchOptimal).toBe(false)
    const serialize = (items: BracketParticipantInput[]) =>
      items.map((item) => `${item.entryId}:${item.seedPosition}`).sort().join('|')
    const firstScore = scoreAssignment(toAssignment(first.participants), 0)
    const secondScore = scoreAssignment(toAssignment(second.participants), 0)
    const changed =
      serialize(first.participants) !== serialize(second.participants) ||
      compareSemantic(firstScore, secondScore) !== 0
    expect(changed).toBe(true)
  })

  it('includes strength tier vectors in semantic score', () => {
    const participants = [
      participant(1, { clubKey: 'club-a', strengthTier: 10 }),
      participant(2, { clubKey: 'club-b', strengthTier: 10 }),
      participant(3, { clubKey: 'club-c', strengthTier: 10 }),
      participant(4, { clubKey: 'club-d', strengthTier: 10 }),
    ]
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-strength-vector',
      lockedPositions: new Map(),
    })
    expect(result.report.strengthConflictVectorsByTier.length).toBeGreaterThan(0)
    expect(result.report.strengthDistribution.byTier.length).toBeGreaterThan(0)
  })

  it('uses lexicographic club conflict vector for tied layouts', () => {
    const left = scoreAssignment(toAssignment(clubGroup(4, 'club-a', 1)), 0)
    const right = scoreAssignment(toAssignment(clubGroup(4, 'club-a', 1).reverse()), 0)
    expect(compareSemantic(left, right)).toBe(0)
  })

  it('allows limited-search drawSeed to affect assignment under node cap', () => {
    const participants = clubGroup(8, 'club-a', 1)
    const first = assignBalancedDraw({
      participants,
      drawSeed: 'h10-limited-a',
      lockedPositions: new Map(),
      maxSearchNodes: 100,
    })
    const second = assignBalancedDraw({
      participants,
      drawSeed: 'h10-limited-b',
      lockedPositions: new Map(),
      maxSearchNodes: 100,
    })
    expect(first.searchOptimal).toBe(false)
    expect(second.searchOptimal).toBe(false)
    const firstScore = scoreAssignment(toAssignment(first.participants), 0)
    const secondScore = scoreAssignment(toAssignment(second.participants), 0)
    const serialize = (items: BracketParticipantInput[]) =>
      items.map((item) => `${item.entryId}:${item.seedPosition}`).sort().join('|')
    const changed =
      serialize(first.participants) !== serialize(second.participants) ||
      compareSemantic(firstScore, secondScore) !== 0
    expect(changed).toBe(true)
  })

  it('completes N=32 within benchmark limits using bounded fallback', { timeout: 30_000 }, () => {
    const clubs = 16
    const participants = Array.from({ length: 32 }, (_, index) =>
      participant(index + 1, {
        clubKey: `club-${index % clubs}`,
        seedPosition: index + 1,
      }),
    )
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-n32',
      lockedPositions: new Map(),
      maxSearchNodes: 2_000,
    })
    expect(result.participants).toHaveLength(32)
    expect(bracketSizeForN(32)).toBe(32)
    expect(result.searchOptimal).toBe(false)
    expect(result.searchStats.elapsedMs).toBeGreaterThanOrEqual(0)
  })
})
