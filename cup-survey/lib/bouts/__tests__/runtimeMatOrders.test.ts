import { describe, expect, it } from 'vitest'
import { buildRuntimeMatOrders } from '../runtimeMatOrders'
import { normalizeAthleteParticipationSpacing } from '../athleteParticipationSpacing'
import { normalizeBoutsPageSettings } from '../normalizeBoutsPageSettings'
import { makeTestBout } from './testBoutHelpers'
import { tournamentInfo, TOURNAMENT_TIMEZONE } from '../../config/tournament'
import { toTournamentInstant } from '../../datetime/tournament'

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

describe('buildRuntimeMatOrders', () => {
  it('falls back to runtime order when planner constraints are unsatisfiable', () => {
    const bout = makeTestBout({
      id: 'cat::only',
      categoryKey: 'cat',
      sideA: athleteSide('a1', 1),
      sideB: athleteSide('a2', 2),
    })
    const final = makeTestBout({
      id: 'cat::final',
      categoryKey: 'cat',
      schedulePhase: 'final',
      sideA: athleteSide('a1', 1),
      sideB: { kind: 'hint', label: 'TBD' },
    })

    const settings = normalizeBoutsPageSettings({
      publicEnabled: true,
      matCount: 1,
      autoMatAssignMode: 'BY_BOUT',
      autoMatByCategoryEnabled: true,
      athleteParticipationSpacing: normalizeAthleteParticipationSpacing({
        enabled: true,
        mode: 'BOUT_COUNT',
        regular: 2,
        medal: 5,
      }),
    })

    const result = buildRuntimeMatOrders({
      groupedMats: [{ matIndex: 1, bouts: [bout, final] }],
      overrides: {},
      settings,
      entryToAthlete: new Map([
        ['a1', 'athlete-1'],
        ['a2', 'athlete-2'],
      ]),
      executions: [],
      restUntilByEntryId: new Map(),
      completedBoutIds: new Set(),
      activeBoutIds: new Set(),
      now: new Date('2026-10-03T12:00:00.000Z'),
      eventDate: tournamentInfo.eventDate,
    })

    expect(result.perMatOrder.get(1)?.map((entry) => entry.id)).toEqual(['cat::only', 'cat::final'])
  })

  it('reorders pending bouts when spacing defers athlete conflict', () => {
    const sharedEntry = 'a-shared'
    const boutMat1 = makeTestBout({
      id: 'cat::m1',
      categoryKey: 'cat',
      sideA: athleteSide(sharedEntry, 1),
      sideB: athleteSide('a2', 2),
    })
    const boutMat2 = makeTestBout({
      id: 'cat::m2',
      categoryKey: 'cat',
      matchNumber: 2,
      sideA: athleteSide(sharedEntry, 1),
      sideB: athleteSide('a3', 3),
    })

    const settings = normalizeBoutsPageSettings({
      publicEnabled: true,
      matCount: 2,
      autoMatAssignMode: 'BY_BOUT',
      autoMatByCategoryEnabled: true,
      athleteParticipationSpacing: normalizeAthleteParticipationSpacing({
        enabled: true,
        mode: 'BOUT_COUNT',
        regular: 2,
        medal: 5,
      }),
    })

    const matStart = toTournamentInstant({
      eventDate: tournamentInfo.eventDate,
      localTime: '10:00',
      timeZone: TOURNAMENT_TIMEZONE,
    })

    const result = buildRuntimeMatOrders({
      groupedMats: [
        { matIndex: 1, bouts: [boutMat1] },
        { matIndex: 2, bouts: [boutMat2] },
      ],
      overrides: {},
      settings: {
        ...settings,
        boutScheduleWaves: { 'cat::m1': 10, 'cat::m2': 10 },
      },
      entryToAthlete: new Map([[sharedEntry, 'athlete-shared']]),
      executions: [],
      restUntilByEntryId: new Map(),
      completedBoutIds: new Set(),
      activeBoutIds: new Set(),
      now: new Date('2026-10-03T12:00:00.000Z'),
      eventDate: tournamentInfo.eventDate,
    })

    expect(result.deferredBouts).toHaveLength(1)
    expect(result.deferredBouts[0]?.reason).toBe('ATHLETE_SPACING')
    expect(result.deferredBouts[0]?.boutId).toBe('cat::m2')
  })

  it('applies queue-after overrides before global spacing resolution', () => {
    const first = makeTestBout({
      id: 'cat::b1',
      categoryKey: 'cat',
      matchNumber: 1,
      sideA: athleteSide('a1', 1),
      sideB: athleteSide('a2', 2),
    })
    const second = makeTestBout({
      id: 'cat::b2',
      categoryKey: 'cat',
      matchNumber: 2,
      sideA: athleteSide('a3', 3),
      sideB: athleteSide('a4', 4),
    })

    const settings = normalizeBoutsPageSettings({
      publicEnabled: true,
      matCount: 1,
      autoMatAssignMode: 'BY_BOUT',
      autoMatByCategoryEnabled: true,
      athleteParticipationSpacing: normalizeAthleteParticipationSpacing({
        enabled: true,
        mode: 'BOUT_COUNT',
        regular: 2,
        medal: 5,
      }),
    })

    const result = buildRuntimeMatOrders({
      groupedMats: [{ matIndex: 1, bouts: [first, second] }],
      overrides: { 'cat::b1': { queueAfterBoutId: 'cat::b2' } },
      settings,
      entryToAthlete: new Map([
        ['a1', 'athlete-1'],
        ['a2', 'athlete-2'],
        ['a3', 'athlete-3'],
        ['a4', 'athlete-4'],
      ]),
      executions: [],
      restUntilByEntryId: new Map(),
      completedBoutIds: new Set(),
      activeBoutIds: new Set(),
      now: new Date('2026-10-03T12:00:00.000Z'),
      eventDate: tournamentInfo.eventDate,
    })

    expect(result.perMatOrder.get(1)?.map((bout) => bout.id)).toEqual(['cat::b2', 'cat::b1'])
  })
})
