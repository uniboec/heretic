import { describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../../brackets/systems/olympic/v1/build'
import { buildRoundRobinV1 } from '../../brackets/systems/round-robin/v1/build'
import '../../brackets/systems'
import {
  compareHeadsForInterleave,
  interleavePhase0Streams,
  sortBoutsForSchedule,
} from '../boutScheduleOrder'
import { extractBouts } from '../extractBouts'
import { sortBouts } from '../sortBouts'
import { buildDistributedSchedules } from '../distributedSchedule'
import {
  assertProposedScheduleStateAcyclic,
  buildProposedScheduleState,
  renumberManualOrderForMat,
} from '../scheduleOverrideMutations'
import { ScheduleConstraintCycleError } from '../errors'
import { groupByEffectiveMatIndex } from '../groupByEffectiveMatIndex'
import { normalizeBoutsPageSettings } from '../normalizeBoutsPageSettings'
import { makeTestBout } from './testBoutHelpers'
import type { InternalBout } from '../types'
import { toTournamentInstant } from '../../datetime/tournament'
import { TOURNAMENT_TIMEZONE } from '../../config/tournament'

const participants = Array.from({ length: 8 }, (_, index) => ({
  entryId: `e${index + 1}`,
  displayName: `Athlete ${index + 1}`,
  clubName: 'Club',
  city: 'City',
  clubIdentity: `club-${index}`,
  publicNumber: index + 1,
  seedPosition: index + 1,
  seedLocked: false,
}))

const categoryMeta = {
  categoryKey: 'cat:a',
  categoryTitle: 'Category A',
  discipline: 'tactic_control',
  storedMatIndex: null,
  competitionStage: 1,
}

describe('extractBouts schedule phases', () => {
  it('assigns elimination, bronze, and final phases from olympic structure', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const bouts = extractBouts(structure, categoryMeta)

    const elimination = bouts.filter((b) => b.schedulePhase === 'elimination')
    const bronze = bouts.filter((b) => b.schedulePhase === 'bronze')
    const finals = bouts.filter((b) => b.schedulePhase === 'final')

    expect(elimination.length).toBeGreaterThan(0)
    expect(bronze).toHaveLength(1)
    expect(finals).toHaveLength(1)
    for (const bout of elimination) {
      expect(bout.roundsUntilFinal).toBeGreaterThan(0)
      expect(bout.round).toBeGreaterThan(0)
    }
    for (const bout of finals) {
      expect(bout.round).toBeGreaterThan(0)
    }
    for (const bout of bronze) {
      expect('round' in bout && bout.round !== undefined).toBe(false)
    }
    expect(bronze[0]?.matchNumber).toBe(8)
  })

  it('assigns round_robin phase from round-robin structure', () => {
    const structure = buildRoundRobinV1({
      participants: participants.slice(0, 4),
      drawSeed: 'seed',
    })
    const bouts = extractBouts(structure, categoryMeta)
    expect(bouts.every((b) => b.schedulePhase === 'round_robin')).toBe(true)
    expect(bouts.every((b) => b.round >= 1)).toBe(true)
  })
})

describe('sortBoutsForSchedule invariants', () => {
  it('does not change bout membership', () => {
    const input = [
      makeTestBout({ id: 'a', categoryKey: 'cat:a', schedulePhase: 'final', round: 3, matchNumber: 7 }),
      makeTestBout({ id: 'b', categoryKey: 'cat:a', schedulePhase: 'bronze', matchNumber: 0 }),
      makeTestBout({
        id: 'c',
        categoryKey: 'cat:a',
        schedulePhase: 'elimination',
        round: 1,
        roundsUntilFinal: 2,
        matchNumber: 1,
      }),
    ]
    const sorted = sortBoutsForSchedule(input)
    expect(sorted.map((b) => b.id).sort()).toEqual(input.map((b) => b.id).sort())
  })

  it('is pure and non-mutating', () => {
    const input = [
      makeTestBout({ id: 'a', categoryKey: 'cat:a', schedulePhase: 'final', round: 3 }),
      makeTestBout({ id: 'b', categoryKey: 'cat:a', schedulePhase: 'elimination', round: 1, roundsUntilFinal: 2 }),
    ]
    const snapshot = JSON.stringify(input)
    const sorted = sortBoutsForSchedule(input)
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(sorted).not.toBe(input)
    expect(sorted[0]?.id).toBe('b')
  })
})

describe('sortBoutsForSchedule phase ordering', () => {
  it('orders single category B=8 as early rounds → bronze → final', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const bouts = extractBouts(structure, categoryMeta)
    const sorted = sortBoutsForSchedule(bouts)

    const bronzeIndex = sorted.findIndex((b) => b.schedulePhase === 'bronze')
    const finalIndex = sorted.findIndex((b) => b.schedulePhase === 'final')
    expect(bronzeIndex).toBeGreaterThan(-1)
    expect(finalIndex).toBeGreaterThan(bronzeIndex)
    for (const bout of sorted.slice(0, bronzeIndex)) {
      expect(['elimination', 'round_robin']).toContain(bout.schedulePhase)
    }
  })

  it('normalizes globally: Cat B (B=16) early rounds before Cat A (B=8) later rounds', () => {
    const structureB = buildOlympicV1({
      participants: Array.from({ length: 16 }, (_, i) => ({
        ...participants[0],
        entryId: `b${i}`,
        publicNumber: i + 1,
        seedPosition: i + 1,
      })),
      drawSeed: 'seed-b',
      options: { bronzeMode: 'ONE' },
    })
    const structureA = buildOlympicV1({
      participants,
      drawSeed: 'seed-a',
      options: { bronzeMode: 'ONE' },
    })

    const catB = extractBouts(structureB, { ...categoryMeta, categoryKey: 'cat:b', categoryTitle: 'Cat B' })
    const catA = extractBouts(structureA, { ...categoryMeta, categoryKey: 'cat:a', categoryTitle: 'Cat A' })

    const sorted = sortBoutsForSchedule([...catB, ...catA])
    const firstB16Round1 = sorted.findIndex(
      (b) => b.categoryKey === 'cat:b' && b.schedulePhase === 'elimination' && b.round === 1,
    )
    const firstA8Quarter = sorted.findIndex(
      (b) => b.categoryKey === 'cat:a' && b.schedulePhase === 'elimination' && b.roundsUntilFinal === 1,
    )
    expect(firstB16Round1).toBeGreaterThan(-1)
    expect(firstA8Quarter).toBeGreaterThan(-1)
    expect(firstB16Round1).toBeLessThan(firstA8Quarter)
  })

  it('orders younger age divisions before older ones regardless of title strings', () => {
    const boys45 = makeTestBout({
      id: 'boys45',
      categoryKey: 'tactic_control:novice:m_boys_1:m_boys_1_w_le_16',
      categoryTitle: 'Тактик Контрол · Новички · 4–5 лет · до 16 кг',
      schedulePhase: 'final',
      round: 1,
      matchNumber: 1,
    })
    const juniors1617 = makeTestBout({
      id: 'juniors1617',
      categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
      categoryTitle: 'Тактик Контрол · Новички · 16–17 лет · до 66 кг',
      schedulePhase: 'final',
      round: 1,
      matchNumber: 1,
    })

    const sorted = sortBoutsForSchedule([juniors1617, boys45])
    expect(sorted.map((bout) => bout.id)).toEqual(['boys45', 'juniors1617'])
  })

  it('orders younger age before older across disciplines on the same mat', () => {
    const close45 = makeTestBout({
      id: 'close45',
      categoryKey: 'close_control:novice:m_boys_1:m_boys_1_w_le_20',
      categoryTitle: 'Клоус Контрол · Новички · 4–5 лет · до 20 кг',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 1,
    })
    const tactic1617 = makeTestBout({
      id: 'tactic1617',
      categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
      categoryTitle: 'Тактик Контрол · Новички · 16–17 лет · до 66 кг',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 1,
    })

    const sorted = sortBoutsForSchedule([tactic1617, close45])
    expect(sorted.map((bout) => bout.id)).toEqual(['close45', 'tactic1617'])
  })

  it('orders B=32 round 1 before B=8 round 1 by roundsUntilFinal', () => {
    const b32 = makeTestBout({
      id: 'b32',
      categoryKey: 'cat:32',
      categoryTitle: 'B32',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 4,
      matchNumber: 1,
    })
    const b8 = makeTestBout({
      id: 'b8',
      categoryKey: 'cat:8',
      categoryTitle: 'B8',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 1,
    })
    const sorted = sortBoutsForSchedule([b8, b32])
    expect(sorted[0]?.id).toBe('b32')
    expect(sorted[1]?.id).toBe('b8')
  })
})

describe('interleavePhase0Streams', () => {
  const elim = (id: string, roundsUntilFinal: number, categoryTitle: string): InternalBout =>
    makeTestBout({
      id,
      categoryKey: `cat:${id}`,
      categoryTitle,
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal,
      matchNumber: 1,
    })

  const rr = (id: string, round: number, categoryTitle: string): InternalBout =>
    makeTestBout({
      id,
      categoryKey: `cat:${id}`,
      categoryTitle,
      schedulePhase: 'round_robin',
      round,
      matchNumber: 1,
    })

  it('preserves internal elimination order', () => {
    const elimination = [elim('e1', 3, 'A'), elim('e2', 2, 'B'), elim('e3', 1, 'C')]
    const roundRobin = [rr('r1', 1, 'Z')]
    const result = interleavePhase0Streams(elimination, roundRobin)
    const elimIds = result.filter((b) => b.schedulePhase === 'elimination').map((b) => b.id)
    expect(elimIds).toEqual(['e1', 'e2', 'e3'])
  })

  it('preserves internal round-robin order', () => {
    const elimination = [elim('e1', 2, 'Z')]
    const roundRobin = [rr('r1', 1, 'A'), rr('r2', 2, 'B')]
    const result = interleavePhase0Streams(elimination, roundRobin)
    const rrIds = result.filter((b) => b.schedulePhase === 'round_robin').map((b) => b.id)
    expect(rrIds).toEqual(['r1', 'r2'])
  })

  it('is deterministic across runs', () => {
    const elimination = [elim('e1', 2, 'A'), elim('e2', 1, 'B')]
    const roundRobin = [rr('r1', 1, 'A'), rr('r2', 1, 'C')]
    const first = interleavePhase0Streams(elimination, roundRobin)
    const second = interleavePhase0Streams(elimination, roundRobin)
    expect(first.map((b) => b.id)).toEqual(second.map((b) => b.id))
  })

  it('prefers elimination on equal interleave heads', () => {
    const a = elim('e1', 1, 'Same')
    const b = rr('r1', 1, 'Same')
    expect(compareHeadsForInterleave(a, b)).toBeLessThan(0)
    const result = interleavePhase0Streams([a], [b])
    expect(result.map((x) => x.id)).toEqual(['e1', 'r1'])
  })
})

describe('schedule v2 pinned policy', () => {
  const matStart = toTournamentInstant({
    eventDate: '2026-10-03',
    localTime: '10:00',
    timeZone: TOURNAMENT_TIMEZONE,
  })

  it('pinAllFinalsToEnd=false allows final before other automatic bouts on same mat', () => {
    const early = makeTestBout({
      id: 'cat:b::early',
      categoryKey: 'cat:b',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
    })
    const final = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
    })
    const matStartTimes = new Map([[1, matStart]])
    const boutsByMat = new Map([[1, [early, final]]])
    const settingsOff = normalizeBoutsPageSettings({
      publicEnabled: true,
      matCount: 1,
      autoMatAssignMode: 'BY_BOUT',
      autoMatByCategoryEnabled: true,
      boutBreakMinutes: 3,
      pinAllFinalsToEnd: false,
    })
    const settingsOn = normalizeBoutsPageSettings({ ...settingsOff, pinAllFinalsToEnd: true })
    const plansOff = buildDistributedSchedules({
      boutsByMat,
      overrides: {},
      settings: settingsOff,
      matStartTimes,
    })
    const plansOn = buildDistributedSchedules({
      boutsByMat,
      overrides: {},
      settings: settingsOn,
      matStartTimes,
    })
    const earlyEndOff = plansOff.get(1)!.find((p) => p.bout.id === 'cat:b::early')!.plannedEndAt
    const earlyEndOn = plansOn.get(1)!.find((p) => p.bout.id === 'cat:b::early')!.plannedEndAt
    const finalOff = plansOff.get(1)!.find((p) => p.bout.id === 'cat:a::final')!
    const finalOn = plansOn.get(1)!.find((p) => p.bout.id === 'cat:a::final')!
    expect(finalOff.plannedStartAt.getTime()).toBeLessThan(earlyEndOff.getTime())
    expect(finalOn.plannedStartAt.getTime()).toBeGreaterThanOrEqual(earlyEndOn.getTime())
  })

  it('pinnedToEnd keeps final after automatic bouts even when manual order lists final first', () => {
    const early = makeTestBout({
      id: 'cat:a::early',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
    })
    const final = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
    })
    const overrides = {
      'cat:a::final': { pinnedToEnd: true, manualOrder: 0 },
      'cat:a::early': { manualOrder: 1 },
    }
    const plans = buildDistributedSchedules({
      boutsByMat: new Map([[1, [early, final]]]),
      overrides,
      settings: normalizeBoutsPageSettings({
        publicEnabled: true,
        matCount: 1,
        autoMatAssignMode: 'BY_BOUT',
        autoMatByCategoryEnabled: true,
        boutBreakMinutes: 3,
        pinAllFinalsToEnd: false,
      }),
      matStartTimes: new Map([[1, matStart]]),
    })
    const earlyPlan = plans.get(1)!.find((p) => p.bout.id === 'cat:a::early')!
    const finalPlan = plans.get(1)!.find((p) => p.bout.id === 'cat:a::final')!
    expect(finalPlan.plannedStartAt.getTime()).toBeGreaterThanOrEqual(earlyPlan.plannedEndAt.getTime())
  })

  it('manual reorder order is stable across schedule rebuilds', () => {
    const head = makeTestBout({
      id: 'cat:a::head',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 1,
    })
    const tail = makeTestBout({
      id: 'cat:b::tail',
      categoryKey: 'cat:b',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 1,
    })
    const matBouts = [head, tail]
    const overrides = renumberManualOrderForMat(matBouts, ['cat:b::tail', 'cat:a::head'], {})
    const settings = normalizeBoutsPageSettings({
      publicEnabled: true,
      matCount: 1,
      autoMatAssignMode: 'BY_BOUT',
      autoMatByCategoryEnabled: true,
      boutBreakMinutes: 3,
      pinAllFinalsToEnd: false,
    })
    const input = {
      boutsByMat: new Map([[1, matBouts]]),
      overrides,
      settings,
      matStartTimes: new Map([[1, matStart]]),
    }
    const order = () => buildDistributedSchedules(input).get(1)!.map((p) => p.bout.id)
    const firstRun = order()
    expect(order()).toEqual(firstRun)
    expect(order()).toEqual(firstRun)
    expect(firstRun).toEqual(['cat:b::tail', 'cat:a::head'])
  })

  it('rejects drag final before semifinal via cycle check', () => {
    const semi = makeTestBout({
      id: 'cat:a::semi',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 2,
      roundsUntilFinal: 1,
    })
    const final = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
      sideA: {
        kind: 'hint',
        label: 'W',
        source: { matchId: 'semi', outcome: 'winner' },
      },
      sideB: { kind: 'bye' },
    })
    const overrides = {
      'cat:a::final': { manualOrder: 0 },
      'cat:a::semi': { manualOrder: 1 },
    }
    expect(() =>
      assertProposedScheduleStateAcyclic(
        buildProposedScheduleState({
          groupedMats: [{ matIndex: 1, bouts: [semi, final] }],
          overrides,
          settings: { pinAllFinalsToEnd: false },
        }),
      ),
    ).toThrow(ScheduleConstraintCycleError)
  })

  it('pinAllFinalsToEnd=true places each final after automatic bouts on its mat', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const bouts = extractBouts(structure, categoryMeta)
    const grouped = groupByEffectiveMatIndex(bouts, 1)
    const settings = normalizeBoutsPageSettings({
      publicEnabled: true,
      matCount: 1,
      autoMatAssignMode: 'BY_BOUT',
      autoMatByCategoryEnabled: true,
      boutBreakMinutes: 3,
      pinAllFinalsToEnd: true,
    })
    const plans = buildDistributedSchedules({
      boutsByMat: new Map(grouped.mats.map((mat) => [mat.matIndex, mat.bouts])),
      overrides: {},
      settings,
      matStartTimes: new Map([[1, matStart]]),
    })
    const ordered = (plans.get(1) ?? []).map((plan) => plan.bout)
    const finalIndex = ordered.findIndex((bout) => bout.schedulePhase === 'final')
    const lastAutomaticIndex = ordered.reduce(
      (max, bout, index) => (bout.schedulePhase !== 'final' ? index : max),
      -1,
    )
    expect(finalIndex).toBeGreaterThan(lastAutomaticIndex)
  })
})

describe('assignment vs schedule sort', () => {
  it('sortBouts differs from sortBoutsForSchedule for olympic bouts', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const bouts = extractBouts(structure, categoryMeta)
    const assignmentOrder = sortBouts(bouts).map((b) => b.id)
    const scheduleOrder = sortBoutsForSchedule(bouts).map((b) => b.id)
    expect(assignmentOrder).not.toEqual(scheduleOrder)
  })
})
