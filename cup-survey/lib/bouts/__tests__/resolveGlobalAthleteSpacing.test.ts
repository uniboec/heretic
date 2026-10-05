import { describe, expect, it } from 'vitest'
import { resolveGlobalAthleteSpacing } from '../resolveGlobalAthleteSpacing'
import { normalizeAthleteParticipationSpacing } from '../athleteParticipationSpacing'
import { makeTestBout } from './testBoutHelpers'

const spacing = normalizeAthleteParticipationSpacing({
  enabled: true,
  mode: 'BOUT_COUNT',
  regular: 2,
  medal: 5,
})

function athleteSide(entryId: string, publicNumber: number) {
  return {
    kind: 'athlete' as const,
    entryId,
    displayName: `Athlete ${publicNumber}`,
    clubName: 'Club',
    city: 'City',
    publicNumber,
  }
}

describe('resolveGlobalAthleteSpacing', () => {
  it('is idempotent for the same state', () => {
    const bout1 = makeTestBout({
      id: 'cat::b1',
      categoryKey: 'cat',
      sideA: athleteSide('a1', 1),
      sideB: athleteSide('a2', 2),
    })
    const bout2 = makeTestBout({
      id: 'cat::b2',
      categoryKey: 'cat',
      sideA: athleteSide('a3', 3),
      sideB: athleteSide('a4', 4),
    })
    const perMatBaseOrder = new Map([[1, [bout1, bout2]]])

    const input = {
      perMatBaseOrder,
      completedBoutIds: new Set<string>(),
      activeBoutIds: new Set<string>(),
      boutScheduleWaves: { 'cat::b1': 1, 'cat::b2': 4 },
      entryToAthlete: new Map<string, string>([
        ['a1', 'athlete-1'],
        ['a2', 'athlete-2'],
      ]),
      spacing,
      executions: [],
      restUntilByEntryId: new Map<string, Date>(),
      now: new Date('2026-10-03T12:00:00.000Z'),
    }

    const result1 = resolveGlobalAthleteSpacing(input)
    const result2 = resolveGlobalAthleteSpacing(input)

    expect(result2.perMatOrder.get(1)?.map((bout) => bout.id)).toEqual(
      result1.perMatOrder.get(1)?.map((bout) => bout.id),
    )
  })

  it('keeps only one nearest eligible bout per athlete across mats', () => {
    const sharedAthleteEntry = 'a-shared'
    const boutMat1 = makeTestBout({
      id: 'cat::m1-b1',
      categoryKey: 'cat',
      matchNumber: 1,
      sideA: athleteSide(sharedAthleteEntry, 1),
      sideB: athleteSide('a2', 2),
    })
    const boutMat2 = makeTestBout({
      id: 'cat::m2-b1',
      categoryKey: 'cat',
      matchNumber: 1,
      sideA: athleteSide(sharedAthleteEntry, 1),
      sideB: athleteSide('a3', 3),
    })

    const perMatBaseOrder = new Map([
      [1, [boutMat1]],
      [2, [boutMat2]],
    ])

    const result = resolveGlobalAthleteSpacing({
      perMatBaseOrder,
      completedBoutIds: new Set<string>(),
      activeBoutIds: new Set<string>(),
      boutScheduleWaves: { 'cat::m1-b1': 10, 'cat::m2-b1': 10 },
      plansByMat: new Map([
        [
          1,
          [
            {
              bout: boutMat1,
              matIndex: 1,
              plannedStartAt: new Date('2026-10-03T10:00:00.000Z'),
              plannedEndAt: new Date('2026-10-03T10:03:00.000Z'),
            },
          ],
        ],
        [
          2,
          [
            {
              bout: boutMat2,
              matIndex: 2,
              plannedStartAt: new Date('2026-10-03T10:01:00.000Z'),
              plannedEndAt: new Date('2026-10-03T10:04:00.000Z'),
            },
          ],
        ],
      ]),
      entryToAthlete: new Map<string, string>([[sharedAthleteEntry, 'athlete-shared']]),
      spacing,
      executions: [],
      restUntilByEntryId: new Map<string, Date>(),
      now: new Date('2026-10-03T12:00:00.000Z'),
    })

    expect(result.deferredBouts).toHaveLength(1)
    expect(result.deferredBouts[0]?.reason).toBe('ATHLETE_SPACING')
    expect(['cat::m1-b1', 'cat::m2-b1']).toContain(result.deferredBouts[0]?.boutId)
  })

  it('defers bout until required wave gap is satisfied and auto-returns when wave passes', () => {
    const athleteEntry = 'a1'
    const firstBout = makeTestBout({
      id: 'cat::b1',
      categoryKey: 'cat',
      sideA: athleteSide(athleteEntry, 1),
      sideB: athleteSide('a2', 2),
    })
    const secondBout = makeTestBout({
      id: 'cat::b2',
      categoryKey: 'cat',
      sideA: athleteSide(athleteEntry, 1),
      sideB: athleteSide('a3', 3),
    })

    const blocked = resolveGlobalAthleteSpacing({
      perMatBaseOrder: new Map([[1, [firstBout, secondBout]]]),
      completedBoutIds: new Set(['cat::b1']),
      activeBoutIds: new Set<string>(),
      boutScheduleWaves: { 'cat::b1': 10, 'cat::b2': 11 },
      entryToAthlete: new Map([[athleteEntry, 'athlete-1']]),
      spacing,
      executions: [
        {
          boutId: 'cat::b1',
          boutPhase: 'completed',
          actualEndAt: new Date('2026-10-03T10:00:00.000Z'),
        },
      ],
      restUntilByEntryId: new Map<string, Date>(),
      now: new Date('2026-10-03T10:05:00.000Z'),
    })

    expect(blocked.perMatOrder.get(1)?.map((bout) => bout.id)).toEqual(['cat::b1', 'cat::b2'])
    expect(blocked.deferredBouts.some((entry) => entry.boutId === 'cat::b2')).toBe(true)

    const returned = resolveGlobalAthleteSpacing({
      perMatBaseOrder: new Map([[1, [firstBout, secondBout]]]),
      completedBoutIds: new Set(['cat::b1']),
      activeBoutIds: new Set<string>(),
      boutScheduleWaves: { 'cat::b1': 10, 'cat::b2': 13 },
      entryToAthlete: new Map([[athleteEntry, 'athlete-1']]),
      spacing,
      executions: [
        {
          boutId: 'cat::b1',
          boutPhase: 'completed',
          actualEndAt: new Date('2026-10-03T10:00:00.000Z'),
        },
      ],
      restUntilByEntryId: new Map<string, Date>(),
      now: new Date('2026-10-03T10:05:00.000Z'),
    })

    expect(returned.perMatOrder.get(1)?.map((bout) => bout.id)).toEqual(['cat::b1', 'cat::b2'])
    expect(returned.deferredBouts.some((entry) => entry.boutId === 'cat::b2')).toBe(false)
  })

  it('checks spacing for known athlete when opponent is still hint', () => {
    const knownAthlete = 'a-known'
    const firstBout = makeTestBout({
      id: 'cat::semi',
      categoryKey: 'cat',
      sideA: athleteSide(knownAthlete, 1),
      sideB: athleteSide('a2', 2),
    })
    const finalBout = makeTestBout({
      id: 'cat::final',
      categoryKey: 'cat',
      schedulePhase: 'final',
      sideA: athleteSide(knownAthlete, 1),
      sideB: { kind: 'hint', label: 'Winner', source: { matchId: 'other-semi', outcome: 'winner' } },
    })

    const result = resolveGlobalAthleteSpacing({
      perMatBaseOrder: new Map([[1, [firstBout, finalBout]]]),
      completedBoutIds: new Set(['cat::semi']),
      activeBoutIds: new Set<string>(),
      boutScheduleWaves: { 'cat::semi': 10, 'cat::final': 11 },
      entryToAthlete: new Map([[knownAthlete, 'athlete-known']]),
      spacing,
      executions: [
        {
          boutId: 'cat::semi',
          boutPhase: 'completed',
          actualEndAt: new Date('2026-10-03T10:00:00.000Z'),
        },
      ],
      restUntilByEntryId: new Map<string, Date>(),
      now: new Date('2026-10-03T10:05:00.000Z'),
    })

    expect(result.deferredBouts.some((entry) => entry.boutId === 'cat::final')).toBe(true)
  })

  it('re-checks both athletes after hint resolves to real opponent', () => {
    const athleteA = 'a1'
    const athleteB = 'a2'
    const firstBout = makeTestBout({
      id: 'cat::b1',
      categoryKey: 'cat',
      sideA: athleteSide(athleteA, 1),
      sideB: athleteSide('a3', 3),
    })
    const secondBout = makeTestBout({
      id: 'cat::b2',
      categoryKey: 'cat',
      sideA: athleteSide(athleteB, 2),
      sideB: athleteSide(athleteA, 1),
    })

    const result = resolveGlobalAthleteSpacing({
      perMatBaseOrder: new Map([[1, [firstBout, secondBout]]]),
      completedBoutIds: new Set(['cat::b1']),
      activeBoutIds: new Set<string>(),
      boutScheduleWaves: { 'cat::b1': 10, 'cat::b2': 11 },
      entryToAthlete: new Map([
        [athleteA, 'athlete-a'],
        [athleteB, 'athlete-b'],
      ]),
      spacing,
      executions: [
        {
          boutId: 'cat::b1',
          boutPhase: 'completed',
          actualEndAt: new Date('2026-10-03T10:00:00.000Z'),
        },
      ],
      restUntilByEntryId: new Map<string, Date>(),
      now: new Date('2026-10-03T10:05:00.000Z'),
    })

    expect(result.deferredBouts.some((entry) => entry.boutId === 'cat::b2')).toBe(true)
  })
})
