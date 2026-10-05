import { describe, expect, it } from 'vitest'
import { resolveClubKey } from '../core/seeding/affiliationKeys'
import { assignBalancedDraw } from '../core/seeding/balancedAssignment'
import { formatRoundLabel, getBracketRegion } from '../core/seeding/bracketRegions'
import { bracketSizeForN } from '../core/seeding/clubSeparation'
import { getStrengthTier } from '../core/seeding/strengthTier'
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

describe('balanced draw H.10', () => {
  it('separates 2 athletes from same club into different halves (B=4)', () => {
    const participants = clubGroup(2, 'club-a')
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-two-club',
      lockedPositions: new Map(),
    })
    const bracketSize = bracketSizeForN(participants.length)
    const regions = result.participants.map((item) =>
      getBracketRegion(item.seedPosition, bracketSize).half,
    )
    expect(new Set(regions).size).toBe(2)
  })

  it('separates 4 athletes from same club into different quarters (B=8)', () => {
    const participants = [
      ...clubGroup(4, 'club-a', 1),
      ...clubGroup(1, 'club-b', 5),
      ...clubGroup(1, 'club-c', 6),
      ...clubGroup(1, 'club-d', 7),
      ...clubGroup(1, 'club-e', 8),
    ]
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-four-club',
      lockedPositions: new Map(),
      maxSearchNodes: 1_000_000,
    })
    const bracketSize = 8
    const clubARegions = result.participants
      .filter((item) => item.clubKey === 'club-a')
      .map((item) => getBracketRegion(item.seedPosition, bracketSize).quarter)
    expect(new Set(clubARegions).size).toBe(4)
  })

  it('keeps locked participant in place', () => {
    const participants = [
      participant(1, { clubKey: 'club-a', seedLocked: true }),
      participant(2, { clubKey: 'club-b' }),
      participant(3, { clubKey: 'club-c' }),
      participant(4, { clubKey: 'club-d' }),
    ]
    const lockedPositions = new Map([[1, 'e1']])
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-locked',
      lockedPositions,
    })
    const locked = result.participants.find((item) => item.entryId === 'e1')
    expect(locked?.seedPosition).toBe(1)
  })

  it('is deterministic for same inputs and drawSeed', () => {
    const participants = [
      ...clubGroup(2, 'club-a', 1),
      ...clubGroup(2, 'club-b', 3),
    ]
    const first = assignBalancedDraw({
      participants: [...participants].reverse(),
      drawSeed: 'h10-determinism',
      lockedPositions: new Map(),
    })
    const second = assignBalancedDraw({
      participants,
      drawSeed: 'h10-determinism',
      lockedPositions: new Map(),
    })
    const serialize = (items: BracketParticipantInput[]) =>
      items
        .map((item) => `${item.entryId}:${item.seedPosition}`)
        .sort((a, b) => a.localeCompare(b))
    expect(serialize(first.participants)).toEqual(serialize(second.participants))
  })

  it('formats round labels for B=32', () => {
    expect(formatRoundLabel(32, 1)).toBe('1/16')
    expect(formatRoundLabel(32, 2)).toBe('1/8')
    expect(formatRoundLabel(32, 3)).toBe('1/4')
    expect(formatRoundLabel(32, 4)).toBe('1/2')
    expect(formatRoundLabel(32, 5)).toBe('Финал')
  })

  it('orders strength tiers monotonically', () => {
    expect(getStrengthTier('msmk')).toBeGreaterThan(getStrengthTier('ms')!)
    expect(getStrengthTier('ms')).toBeGreaterThan(getStrengthTier('kms')!)
    expect(getStrengthTier('adult_1')).toBeGreaterThan(getStrengthTier('youth_1')!)
  })

  it('spreads 8 athletes of one club across eighths (B=8)', { timeout: 15_000 }, () => {
    const participants = clubGroup(8, 'club-a', 1)
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-eight-club',
      lockedPositions: new Map(),
      maxSearchNodes: 500_000,
    })
    const bracketSize = bracketSizeForN(participants.length)
    const eighths = result.participants.map((item) =>
      getBracketRegion(item.seedPosition, bracketSize).eighth,
    )
    expect(new Set(eighths).size).toBe(8)
  })

  it('prefers club separation over city grouping', () => {
    const participants = [
      participant(1, { clubKey: 'club-a', cityKey: 'city-1' }),
      participant(2, { clubKey: 'club-b', cityKey: 'city-1' }),
      participant(3, { clubKey: 'club-a', cityKey: 'city-2' }),
      participant(4, { clubKey: 'club-b', cityKey: 'city-2' }),
    ]
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-club-city',
      lockedPositions: new Map(),
    })
    const bracketSize = bracketSizeForN(participants.length)
    const clubA = result.participants
      .filter((item) => item.clubKey === 'club-a')
      .map((item) => getBracketRegion(item.seedPosition, bracketSize).half)
    expect(new Set(clubA).size).toBe(2)
  })

  it('ignores null clubKey and cityKey in grouping', () => {
    const participants = [
      participant(1, { clubKey: null, cityKey: null }),
      participant(2, { clubKey: null, cityKey: null }),
      participant(3, { clubKey: 'club-a', cityKey: 'city-a' }),
      participant(4, { clubKey: 'club-b', cityKey: 'city-b' }),
    ]
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-null-keys',
      lockedPositions: new Map(),
    })
    expect(result.report.clubSeparation.byClubKey.every((club) => club.clubKey != null)).toBe(true)
    expect(result.report.currentPotentialMeetings.every((item) => item.groupKey)).toBe(true)
  })

  it('includes currentEarlyConflicts in report', () => {
    const participants = clubGroup(4, 'club-a', 1)
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-early-conflicts',
      lockedPositions: new Map(),
      maxSearchNodes: 1_000_000,
    })
    expect(Array.isArray(result.report.currentEarlyConflicts)).toBe(true)
    expect(Array.isArray(result.report.currentPotentialMeetings)).toBe(true)
  })

  it('uses same club name in different cities as distinct club keys', () => {
    const cityA = resolveClubKey(null, 'Shared Club', 'Moscow')
    const cityB = resolveClubKey(null, 'Shared Club', 'Kazan')
    expect(cityA).not.toBe(cityB)

    const participants = [
      participant(1, { clubKey: cityA!, cityKey: 'moscow' }),
      participant(2, { clubKey: cityB!, cityKey: 'kazan' }),
      participant(3, { clubKey: 'club-c', cityKey: 'city-c' }),
      participant(4, { clubKey: 'club-d', cityKey: 'city-d' }),
    ]
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-same-name-diff-city',
      lockedPositions: new Map(),
    })
    expect(result.participants).toHaveLength(4)
  })

  it('prefers club separation over strength tier spread', () => {
    const participants = [
      participant(1, { clubKey: 'club-a', strengthTier: 10 }),
      participant(2, { clubKey: 'club-a', strengthTier: 1 }),
      participant(3, { clubKey: 'club-b', strengthTier: 9 }),
      participant(4, { clubKey: 'club-c', strengthTier: 8 }),
    ]
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-club-over-tier',
      lockedPositions: new Map(),
    })
    const bracketSize = bracketSizeForN(participants.length)
    const clubA = result.participants
      .filter((item) => item.clubKey === 'club-a')
      .map((item) => getBracketRegion(item.seedPosition, bracketSize).half)
    expect(new Set(clubA).size).toBe(2)
  })

  it('spreads four highest strength tiers across quarters when clubs differ', () => {
    const participants = [
      participant(1, { clubKey: 'club-a', strengthTier: 10 }),
      participant(2, { clubKey: 'club-b', strengthTier: 9 }),
      participant(3, { clubKey: 'club-c', strengthTier: 8 }),
      participant(4, { clubKey: 'club-d', strengthTier: 7 }),
      participant(5, { clubKey: 'club-e', strengthTier: 1 }),
      participant(6, { clubKey: 'club-f', strengthTier: 1 }),
      participant(7, { clubKey: 'club-g', strengthTier: 1 }),
      participant(8, { clubKey: 'club-h', strengthTier: 1 }),
    ]
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-tier-quarters',
      lockedPositions: new Map(),
      maxSearchNodes: 500_000,
    })
    const bracketSize = 8
    const topTiers = result.participants
      .filter((item) => (item.strengthTier ?? 0) >= 7)
      .map((item) => getBracketRegion(item.seedPosition, bracketSize).quarter)
    expect(new Set(topTiers).size).toBeGreaterThanOrEqual(3)
  })

  it('uses descriptive warnings, not impossibility claims', () => {
    const participants = clubGroup(4, 'club-a', 1)
    const result = assignBalancedDraw({
      participants,
      drawSeed: 'h10-warnings',
      lockedPositions: new Map(),
      maxSearchNodes: 500_000,
    })
    for (const warning of result.report.summary.warnings) {
      expect(warning).not.toMatch(/невозможно/i)
      expect(warning).toMatch(/остаётся/i)
    }
  })
})
