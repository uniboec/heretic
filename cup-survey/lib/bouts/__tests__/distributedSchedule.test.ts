import { describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../../brackets/systems/olympic/v1/build'
import '../../brackets/systems'
import {
  buildDistributedSchedules,
  buildDistributedSchedulesWithFallback,
} from '../distributedSchedule'
import { UnsatisfiableScheduleError } from '../errors'
import { normalizeAthleteParticipationSpacing } from '../athleteParticipationSpacing'
import { extractBouts } from '../extractBouts'
import { groupByEffectiveMatIndex } from '../groupByEffectiveMatIndex'
import { normalizeBoutsPageSettings } from '../normalizeBoutsPageSettings'
import {
  activePolicyPredecessorsFromGraph,
  buildScheduleConstraintGraph,
} from '../scheduleConstraintGraph'
import { buildSportDependencyGraph, sportDescendantClosure } from '../sportDependencies'
import { PinCascadeConfirmationRequiredError, ScheduleConstraintCycleError } from '../errors'
import {
  assertPinCascadeConfirmed,
  assertProposedScheduleStateAcyclic,
  buildProposedScheduleState,
  getPinCascadeDescendantIds,
  renumberManualOrderForMat,
} from '../scheduleOverrideMutations'
import { clearManualOrderForMat, sanitizeManualOrderForMat } from '../scheduleOverrides'
import { makeTestBout } from './testBoutHelpers'
import { toTournamentInstant } from '../../datetime/tournament'
import { TOURNAMENT_TIMEZONE } from '../../config/tournament'
import type { InternalBoutSide } from '../types'

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

const baseSettings = normalizeBoutsPageSettings({
  publicEnabled: true,
  matCount: 2,
  autoMatAssignMode: 'BY_BOUT',
  autoMatByCategoryEnabled: true,
  boutBreakMinutes: 3,
  pinAllFinalsToEnd: false,
})

function matStart(): Date {
  return toTournamentInstant({
    eventDate: '2026-10-03',
    localTime: '10:00',
    timeZone: TOURNAMENT_TIMEZONE,
  })
}

function hintSide(matchId: string, outcome: 'winner' | 'loser' = 'winner'): InternalBoutSide {
  return { kind: 'hint', label: 'TBD', source: { matchId, outcome } }
}

function schedulePlans(
  boutsByMat: Map<number, ReturnType<typeof makeTestBout>[]>,
  overrides: Record<string, { manualOrder?: number; pinnedToEnd?: boolean }> = {},
  settings = baseSettings,
) {
  const matStartTimes = new Map([...boutsByMat.keys()].map((matIndex) => [matIndex, matStart()]))
  return buildDistributedSchedules({
    boutsByMat,
    overrides,
    settings,
    matStartTimes,
  })
}

describe('buildDistributedSchedules', () => {
  it('plans cross-mat sport dependency: semifinal ends before final starts', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const bouts = extractBouts(structure, {
      categoryKey: 'cat:a',
      categoryTitle: 'A',
      discipline: 'tactic_control',
      storedMatIndex: null,
      competitionStage: 1,
    })
    const grouped = groupByEffectiveMatIndex(bouts, 2)
    const boutsByMat = new Map(grouped.mats.map((m) => [m.matIndex, m.bouts]))
    const plans = schedulePlans(boutsByMat)

    const allPlans = [...plans.values()].flat()
    const semifinals = allPlans.filter(
      (p) => p.bout.schedulePhase === 'elimination' && p.bout.roundsUntilFinal === 1,
    )
    const finals = allPlans.filter((p) => p.bout.schedulePhase === 'final')
    expect(semifinals.length).toBeGreaterThan(0)
    expect(finals.length).toBe(1)
    for (const semi of semifinals) {
      for (const final of finals) {
        expect(final.plannedStartAt.getTime()).toBeGreaterThanOrEqual(semi.plannedEndAt.getTime())
      }
    }
  })

  it('does not create false cycle for pinned/automatic manualOrder on same mat', () => {
    const pinned = makeTestBout({
      id: 'cat:a::pinned',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
    })
    const automatic = makeTestBout({
      id: 'cat:a::auto',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
    })
    const overrides = renumberManualOrderForMat(
      [pinned, automatic],
      ['cat:a::pinned', 'cat:a::auto'],
      {},
    )
    const state = buildProposedScheduleState({
      groupedMats: [{ matIndex: 1, bouts: [pinned, automatic] }],
      overrides,
      settings: { pinAllFinalsToEnd: true },
    })
    expect(() => assertProposedScheduleStateAcyclic(state)).not.toThrow()
  })

  it('rejects manual + sport cycle on same mat', () => {
    const a = makeTestBout({
      id: 'cat:a::a',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
    })
    const b = makeTestBout({
      id: 'cat:a::b',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 1,
    })
    const sportGraph = buildSportDependencyGraph([a, b], new Set(['cat:a::a', 'cat:a::b']))
    sportGraph.predecessors.set('cat:a::a', new Set(['cat:a::b']))
    sportGraph.successors.set('cat:a::b', new Set(['cat:a::a']))
    const overrides = renumberManualOrderForMat([a, b], ['cat:a::a', 'cat:a::b'], {})

    expect(() =>
      buildScheduleConstraintGraph({
        bouts: [a, b],
        boutsByMat: new Map([[1, [a, b]]]),
        sportGraph,
        overrides,
        pinAllFinalsToEnd: false,
        pinnedClosure: new Set(),
        partitions: new Map([['cat:a::a', 'automatic'], ['cat:a::b', 'automatic']]),
      }),
    ).toThrow(ScheduleConstraintCycleError)
  })

  it('policy temporal cross-mat: final starts after bronze ends', () => {
    const semi = makeTestBout({
      id: 'cat:a::semi',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 2,
      roundsUntilFinal: 1,
    })
    const bronze = makeTestBout({
      id: 'cat:a::bronze',
      categoryKey: 'cat:a',
      schedulePhase: 'bronze',
    })
    const final = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
      sideA: hintSide('semi'),
      sideB: { kind: 'bye' },
    })
    const plans = schedulePlans(new Map([[1, [semi, bronze]], [2, [final]]]))
    const bronzePlan = plans.get(1)!.find((p) => p.bout.id === 'cat:a::bronze')!
    const finalPlan = plans.get(2)!.find((p) => p.bout.id === 'cat:a::final')!
    expect(finalPlan.plannedStartAt.getTime()).toBeGreaterThanOrEqual(
      bronzePlan.plannedEndAt.getTime(),
    )
  })

  it('manual not global: mat2 continues while mat1 final waits on cross-mat sport dep', () => {
    const final = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
      sideA: hintSide('semi'),
      sideB: { kind: 'bye' },
    })
    const semi = makeTestBout({
      id: 'cat:a::semi',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 2,
      roundsUntilFinal: 1,
    })
    const other = makeTestBout({
      id: 'cat:b::r1',
      categoryKey: 'cat:b',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
    })
    const overrides = renumberManualOrderForMat([final], ['cat:a::final'], {})
    const plans = schedulePlans(new Map([[1, [final]], [2, [semi, other]]]), overrides)
    const finalPlan = plans.get(1)![0]!
    const semiPlan = plans.get(2)!.find((p) => p.bout.id === 'cat:a::semi')!
    expect(semiPlan.plannedStartAt.getTime()).toBe(matStart().getTime())
    expect(finalPlan.plannedStartAt.getTime()).toBeGreaterThanOrEqual(semiPlan.plannedEndAt.getTime())
    const mat2Plans = plans.get(2) ?? []
    expect(mat2Plans.length).toBe(2)
  })

  it('pinned partition waits for automatic bouts on same mat only', () => {
    const early = makeTestBout({
      id: 'cat:a::early',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
    })
    const pinned = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
    })
    const plans = schedulePlans(
      new Map([[1, [early, pinned]]]),
      { 'cat:a::final': { pinnedToEnd: true } },
    )
    const ordered = plans.get(1)!
    const earlyIndex = ordered.findIndex((p) => p.bout.id === 'cat:a::early')
    const finalIndex = ordered.findIndex((p) => p.bout.id === 'cat:a::final')
    expect(finalIndex).toBeGreaterThan(earlyIndex)
  })

  it('pin cascade closure includes sport descendants', () => {
    const semi = makeTestBout({ id: 'cat:a::semi', categoryKey: 'cat:a', schedulePhase: 'elimination', round: 2, roundsUntilFinal: 1 })
    const final = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
      sideA: hintSide('semi'),
      sideB: { kind: 'bye' },
    })
    const cascade = getPinCascadeDescendantIds('cat:a::semi', [semi, final], {})
    expect(cascade).toContain('cat:a::final')
  })

  it('requires cascade confirmation when pinning affects descendants', () => {
    const semi = makeTestBout({ id: 'cat:a::semi', categoryKey: 'cat:a', schedulePhase: 'elimination', round: 2, roundsUntilFinal: 1 })
    const final = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
      sideA: hintSide('semi'),
      sideB: { kind: 'bye' },
    })
    expect(() =>
      assertPinCascadeConfirmed({
        boutId: 'cat:a::semi',
        pinnedToEnd: true,
        allBouts: [semi, final],
        overrides: {},
      }),
    ).toThrow(PinCascadeConfirmationRequiredError)
    expect(() =>
      assertPinCascadeConfirmed({
        boutId: 'cat:a::semi',
        pinnedToEnd: true,
        confirmCascade: true,
        allBouts: [semi, final],
        overrides: {},
      }),
    ).not.toThrow()
  })

  it('unpin releases cascade-only descendants from closure', () => {
    const semi = makeTestBout({ id: 'cat:a::semi', categoryKey: 'cat:a', schedulePhase: 'elimination', round: 2, roundsUntilFinal: 1 })
    const final = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
      sideA: hintSide('semi'),
      sideB: { kind: 'bye' },
    })
    const graph = buildSportDependencyGraph([semi, final], new Set(['cat:a::semi', 'cat:a::final']))
    const pinnedOnlySemi = sportDescendantClosure(new Set(['cat:a::semi']), graph)
    expect(pinnedOnlySemi.has('cat:a::final')).toBe(true)
    const pinnedBoth = sportDescendantClosure(
      new Set(['cat:a::semi', 'cat:a::final']),
      graph,
    )
    expect(pinnedBoth.has('cat:a::final')).toBe(true)
    const afterUnpinSemi = sportDescendantClosure(new Set(['cat:a::final']), graph)
    expect(afterUnpinSemi.has('cat:a::final')).toBe(true)
    expect(afterUnpinSemi.has('cat:a::semi')).toBe(false)
  })

  it('sanitizes corrupt partial manual order on mat load', () => {
    const a = makeTestBout({ id: 'cat:a::a', categoryKey: 'cat:a' })
    const b = makeTestBout({ id: 'cat:a::b', categoryKey: 'cat:a' })
    const sanitized = sanitizeManualOrderForMat(
      [a, b],
      { 'cat:a::a': { manualOrder: 0 } },
    )
    expect(sanitized['cat:a::a']?.manualOrder).toBeUndefined()
  })

  it('clearManualOrderForMat removes manualOrder including index 0', () => {
    const a = makeTestBout({ id: 'cat:a::a', categoryKey: 'cat:a' })
    const cleared = clearManualOrderForMat([a], { 'cat:a::a': { manualOrder: 0 } })
    expect(cleared['cat:a::a']).toBeUndefined()
  })

  it('preserves boutId to mat assignment (schedule v2 does not move mats)', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const bouts = extractBouts(structure, {
      categoryKey: 'cat:a',
      categoryTitle: 'A',
      discipline: 'tactic_control',
      storedMatIndex: null,
      competitionStage: 1,
    })
    const grouped = groupByEffectiveMatIndex(bouts, 2)
    const assignment = new Map<string, number>()
    for (const mat of grouped.mats) {
      for (const bout of mat.bouts) assignment.set(bout.id, mat.matIndex)
    }
    const plans = schedulePlans(new Map(grouped.mats.map((m) => [m.matIndex, m.bouts])))
    for (const [matIndex, matPlans] of plans) {
      for (const plan of matPlans) {
        expect(assignment.get(plan.bout.id)).toBe(matIndex)
      }
    }
  })

  it('idle gap: mat2 schedules while mat1 final waits on cross-mat predecessor', () => {
    const final = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
      sideA: hintSide('semi'),
      sideB: { kind: 'bye' },
    })
    const semi = makeTestBout({
      id: 'cat:a::semi',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 2,
      roundsUntilFinal: 1,
    })
    const filler = makeTestBout({
      id: 'cat:b::r1',
      categoryKey: 'cat:b',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
    })
    const plans = schedulePlans(new Map([[1, [final]], [2, [semi, filler]]]))
    const semiPlan = plans.get(2)!.find((p) => p.bout.id === 'cat:a::semi')!
    const fillerPlan = plans.get(2)!.find((p) => p.bout.id === 'cat:b::r1')!
    const finalPlan = plans.get(1)![0]!
    expect(semiPlan.plannedStartAt.getTime()).toBe(matStart().getTime())
    expect(finalPlan.plannedStartAt.getTime()).toBeGreaterThanOrEqual(semiPlan.plannedEndAt.getTime())
    expect(fillerPlan.plannedStartAt.getTime()).toBeGreaterThanOrEqual(semiPlan.plannedStartAt.getTime())
    expect(finalPlan.plannedStartAt.getTime()).toBeGreaterThanOrEqual(semiPlan.plannedEndAt.getTime())
  })

  it('manual strict: non-head bout in manual queue waits for head on same mat', () => {
    const head = makeTestBout({
      id: 'cat:a::head',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 1,
    })
    const tail = makeTestBout({
      id: 'cat:a::tail',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 2,
    })
    const matBouts = [head, tail]
    const overrides = renumberManualOrderForMat(matBouts, ['cat:a::head', 'cat:a::tail'], {})
    const plans = schedulePlans(new Map([[1, matBouts]]), overrides)
    const headPlan = plans.get(1)!.find((p) => p.bout.id === 'cat:a::head')!
    const tailPlan = plans.get(1)!.find((p) => p.bout.id === 'cat:a::tail')!
    expect(headPlan.plannedStartAt.getTime()).toBeLessThan(tailPlan.plannedStartAt.getTime())
  })

  it('policy incremental: bronze→final edge omitted when manual final→bronze creates conflict', () => {
    const bronze = makeTestBout({
      id: 'cat:a::bronze',
      categoryKey: 'cat:a',
      schedulePhase: 'bronze',
    })
    const final = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
    })
    const bouts = [bronze, final]
    const overrides = renumberManualOrderForMat(bouts, ['cat:a::final', 'cat:a::bronze'], {})
    const sportGraph = buildSportDependencyGraph(bouts, new Set(bouts.map((b) => b.id)))
    const partitions = new Map(bouts.map((b) => [b.id, 'automatic' as const]))
    const graph = buildScheduleConstraintGraph({
      bouts,
      boutsByMat: new Map([[1, bouts]]),
      sportGraph,
      overrides,
      pinAllFinalsToEnd: false,
      pinnedClosure: new Set(),
      partitions,
    })
    expect(activePolicyPredecessorsFromGraph('cat:a::final', graph)).toEqual([])
  })

  it('policy eligible: final is not planned until bronze ends on another mat', () => {
    const bronze = makeTestBout({
      id: 'cat:a::bronze',
      categoryKey: 'cat:a',
      schedulePhase: 'bronze',
    })
    const final = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      schedulePhase: 'final',
      round: 3,
    })
    const plans = schedulePlans(new Map([[1, [bronze]], [2, [final]]]))
    const bronzePlan = plans.get(1)![0]!
    const finalPlan = plans.get(2)![0]!
    expect(finalPlan.plannedStartAt.getTime()).toBeGreaterThanOrEqual(bronzePlan.plannedEndAt.getTime())
  })

  it('rejects cross-mat manual + sport cycle A→B→C→D→A', () => {
    const a = makeTestBout({
      id: 'cat:a::a',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 3,
      matchNumber: 1,
      sideA: hintSide('d'),
      sideB: { kind: 'bye' },
    })
    const b = makeTestBout({
      id: 'cat:a::b',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 3,
      matchNumber: 2,
      sideA: hintSide('a'),
      sideB: { kind: 'bye' },
    })
    const c = makeTestBout({
      id: 'cat:a::c',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 3,
      matchNumber: 3,
      sideA: hintSide('b'),
      sideB: { kind: 'bye' },
    })
    const d = makeTestBout({
      id: 'cat:a::d',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 3,
      matchNumber: 4,
      sideA: hintSide('c'),
      sideB: { kind: 'bye' },
    })
    const overrides = {
      ...renumberManualOrderForMat([a, b], ['cat:a::a', 'cat:a::b'], {}),
      ...renumberManualOrderForMat([c, d], ['cat:a::c', 'cat:a::d'], {}),
    }
    const state = buildProposedScheduleState({
      groupedMats: [{ matIndex: 1, bouts: [a, b] }, { matIndex: 2, bouts: [c, d] }],
      overrides,
      settings: { pinAllFinalsToEnd: false },
    })
    expect(() => assertProposedScheduleStateAcyclic(state)).toThrow(ScheduleConstraintCycleError)
  })

  it('scheduler is deterministic across three runs', () => {
    const structure = buildOlympicV1({
      participants,
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const bouts = extractBouts(structure, {
      categoryKey: 'cat:a',
      categoryTitle: 'A',
      discipline: 'tactic_control',
      storedMatIndex: null,
      competitionStage: 1,
    })
    const grouped = groupByEffectiveMatIndex(bouts, 2)
    const boutsByMat = new Map(grouped.mats.map((m) => [m.matIndex, m.bouts]))
    const run = () =>
      [...schedulePlans(boutsByMat).values()]
        .flat()
        .map((plan) => plan.bout.id)
        .join(',')
    const first = run()
    expect(run()).toBe(first)
    expect(run()).toBe(first)
  })

  it('interleaves categories via pickMaxRestGapMinutes when rounds are tied', () => {
    const catAEarly = makeTestBout({
      id: 'cat:a::r1',
      categoryKey: 'cat:a',
      categoryTitle: 'Category A',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 1,
    })
    const catBEarly = makeTestBout({
      id: 'cat:b::r1',
      categoryKey: 'cat:b',
      categoryTitle: 'Category B',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 1,
    })
    const plans = schedulePlans(new Map([[1, [catAEarly, catBEarly]]]))
    const ordered = plans.get(1)!.map((p) => p.bout.id)
    expect(ordered).toHaveLength(2)
    expect(new Set(ordered)).toEqual(new Set(['cat:a::r1', 'cat:b::r1']))
  })

  it('rejects reorder that violates sport order via cycle check', () => {
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
      sideA: hintSide('semi'),
      sideB: { kind: 'bye' },
    })
    const overrides = renumberManualOrderForMat([semi, final], ['cat:a::final', 'cat:a::semi'], {})
    const state = buildProposedScheduleState({
      groupedMats: [{ matIndex: 1, bouts: [semi, final] }],
      overrides,
      settings: { pinAllFinalsToEnd: false },
    })
    expect(() => assertProposedScheduleStateAcyclic(state)).toThrow(ScheduleConstraintCycleError)
  })

  it('stage 2 on mat 2 waits for stage 1 on mat 1 to finish plus stage break', () => {
    const stage1 = makeTestBout({ id: 'cat:a::1', categoryKey: 'cat:a', competitionStage: 1 })
    const stage2 = makeTestBout({ id: 'cat:b::1', categoryKey: 'cat:b', competitionStage: 2 })
    const settings = normalizeBoutsPageSettings({
      ...baseSettings,
      competitionStageSettings: {
        breaksAfterStageMinutes: { '1': 10 },
        notBeforeStartTimes: {},
      },
    })
    const plans = schedulePlans(new Map([[1, [stage1]], [2, [stage2]]]), {}, settings)
    const stage1Plan = plans.get(1)![0]!
    const stage2Plan = plans.get(2)![0]!
    expect(stage2Plan.plannedStartAt.getTime()).toBeGreaterThanOrEqual(
      stage1Plan.plannedEndAt.getTime() + 10 * 60_000,
    )
  })

  it('plans pinned stage-1 final and stage-2 automatic on same mat without deadlock', () => {
    const pinnedFinal = makeTestBout({
      id: 'cat:a::final',
      categoryKey: 'cat:a',
      competitionStage: 1,
      schedulePhase: 'final',
      round: 3,
    })
    const stage2Bout = makeTestBout({
      id: 'cat:b::1',
      categoryKey: 'cat:b',
      competitionStage: 2,
    })
    const overrides = { [pinnedFinal.id]: { pinnedToEnd: true } }
    const plans = schedulePlans(new Map([[1, [pinnedFinal, stage2Bout]]]), overrides)
    expect(plans.get(1)).toHaveLength(2)
    const ordered = plans.get(1)!.map((plan) => plan.bout.id)
    expect(ordered.indexOf(pinnedFinal.id)).toBeLessThan(ordered.indexOf(stage2Bout.id))
  })

  it('skips empty stage 2 when only stages 1 and 3 are used', () => {
    const stage1 = makeTestBout({ id: 'cat:a::1', categoryKey: 'cat:a', competitionStage: 1 })
    const stage3 = makeTestBout({ id: 'cat:c::1', categoryKey: 'cat:c', competitionStage: 3 })
    const settings = normalizeBoutsPageSettings({
      ...baseSettings,
      competitionStageSettings: {
        breaksAfterStageMinutes: { '1': 5, '2': 99 },
        notBeforeStartTimes: { '3': '13:00' },
      },
    })
    const plans = schedulePlans(new Map([[1, [stage1, stage3]]]), {}, settings)
    const stage1Plan = plans.get(1)!.find((plan) => plan.bout.id === stage1.id)!
    const stage3Plan = plans.get(1)!.find((plan) => plan.bout.id === stage3.id)!
    expect(stage3Plan.plannedStartAt.getTime()).toBeGreaterThan(stage1Plan.plannedEndAt.getTime())
  })

  it('preserves postpone anchor when bout is moved after anchor on mat', () => {
    const anchor = makeTestBout({
      id: 'cat:a::anchor',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 1,
    })
    const middle = makeTestBout({
      id: 'cat:a::middle',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 2,
    })
    const postponed = makeTestBout({
      id: 'cat:a::postponed',
      categoryKey: 'cat:a',
      schedulePhase: 'elimination',
      round: 1,
      roundsUntilFinal: 2,
      matchNumber: 3,
    })
    const matBouts = [anchor, middle, postponed]

    const orderedIds = matBouts.map((bout) => bout.id)
    orderedIds.splice(2, 1)
    orderedIds.splice(1, 0, postponed.id)

    const overrides = renumberManualOrderForMat(matBouts, orderedIds, {})
    const plans = schedulePlans(new Map([[1, matBouts]]), overrides)
    const orderedPlans = plans.get(1)!.sort(
      (left, right) => left.plannedStartAt.getTime() - right.plannedStartAt.getTime(),
    )

    expect(orderedPlans.map((plan) => plan.bout.id)).toEqual([
      'cat:a::anchor',
      'cat:a::postponed',
      'cat:a::middle',
    ])
    expect(overrides['cat:a::postponed']?.manualOrder).toBe(1)
    expect(overrides['cat:a::anchor']?.manualOrder).toBe(0)
  })

  it('enforces spacing for known athlete when opponent side is hint', () => {
    const settings = normalizeBoutsPageSettings({
      publicEnabled: true,
      matCount: 1,
      autoMatAssignMode: 'BY_BOUT',
      autoMatByCategoryEnabled: true,
      boutBreakMinutes: 3,
      pinAllFinalsToEnd: false,
      athleteParticipationSpacing: {
        enabled: true,
        mode: 'BOUT_COUNT',
        regular: 2,
        medal: 2,
      },
    })
    const entryToAthlete = new Map(
      ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12'].map(
        (entryId, index) => [entryId, `athlete-${index + 1}`],
      ),
    )
    entryToAthlete.set('e1', 'athlete-1')
    const athlete = (entryId: string, publicNumber: number) => ({
      kind: 'athlete' as const,
      entryId,
      displayName: `Athlete ${publicNumber}`,
      clubName: 'Club',
      city: 'City',
      publicNumber,
    })
    const first = makeTestBout({
      id: 'cat::r1',
      categoryKey: 'cat',
      sideA: athlete('e1', 1),
      sideB: athlete('e2', 2),
    })
    const fillerMat1 = makeTestBout({
      id: 'cat::f1',
      categoryKey: 'cat',
      matchNumber: 2,
      sideA: athlete('e3', 3),
      sideB: athlete('e4', 4),
    })
    const fillerMat2 = makeTestBout({
      id: 'cat::f2',
      categoryKey: 'cat',
      matchNumber: 3,
      sideA: athlete('e5', 5),
      sideB: athlete('e6', 6),
    })
    const fillerMat2b = makeTestBout({
      id: 'cat::f3',
      categoryKey: 'cat',
      matchNumber: 4,
      sideA: athlete('e7', 7),
      sideB: athlete('e8', 8),
    })
    const fillerMat1b = makeTestBout({
      id: 'cat::f4',
      categoryKey: 'cat',
      matchNumber: 5,
      sideA: athlete('e9', 9),
      sideB: athlete('e10', 10),
    })
    const fillerMat2c = makeTestBout({
      id: 'cat::f5',
      categoryKey: 'cat',
      matchNumber: 6,
      sideA: athlete('e11', 11),
      sideB: athlete('e12', 12),
    })
    const secondForAthlete = makeTestBout({
      id: 'cat::r2',
      categoryKey: 'cat',
      matchNumber: 3,
      sideA: athlete('e1', 1),
      sideB: { kind: 'hint', label: 'TBD' },
    })
    const plans = buildDistributedSchedules({
      boutsByMat: new Map([
        [1, [first, fillerMat1, fillerMat1b]],
        [2, [fillerMat2, fillerMat2b, fillerMat2c, secondForAthlete]],
      ]),
      overrides: {},
      settings,
      matStartTimes: new Map([[1, matStart()], [2, matStart()]]),
      entryToAthlete,
    })
    const firstPlan = [...plans.values()].flat().find((plan) => plan.bout.id === 'cat::r1')
    const secondPlan = [...plans.values()].flat().find((plan) => plan.bout.id === 'cat::r2')
    expect(firstPlan?.scheduleWave).toBeDefined()
    expect(secondPlan?.scheduleWave).toBeDefined()
    const gap = (secondPlan!.scheduleWave ?? 0) - (firstPlan!.scheduleWave ?? 0) - 1
    expect(gap).toBeGreaterThanOrEqual(2)
  })
})

function athleteSide(entryId: string, publicNumber: number): InternalBoutSide {
  return {
    kind: 'athlete',
    entryId,
    displayName: `Athlete ${publicNumber}`,
    clubName: 'Club',
    city: 'City',
    publicNumber,
  }
}

describe('buildDistributedSchedulesWithFallback', () => {
  it('returns planner order when constraints are satisfiable', () => {
    const bout = makeTestBout({
      id: 'cat::only',
      categoryKey: 'cat',
      sideA: athleteSide('e1', 1),
      sideB: athleteSide('e2', 2),
    })
    const plans = buildDistributedSchedulesWithFallback({
      boutsByMat: new Map([[1, [bout]]]),
      overrides: {},
      settings: baseSettings,
      matStartTimes: new Map([[1, matStart()]]),
    })
    expect(plans.get(1)?.map((plan) => plan.bout.id)).toEqual(['cat::only'])
  })

  it('falls back to schedule sort order when planner constraints are unsatisfiable', () => {
    const bout = makeTestBout({
      id: 'cat::only',
      categoryKey: 'cat',
      sideA: athleteSide('e1', 1),
      sideB: athleteSide('e2', 2),
    })
    const final = makeTestBout({
      id: 'cat::final',
      categoryKey: 'cat',
      schedulePhase: 'final',
      sideA: athleteSide('e1', 1),
      sideB: { kind: 'hint', label: 'TBD' },
    })
    const settings = normalizeBoutsPageSettings({
      ...baseSettings,
      athleteParticipationSpacing: normalizeAthleteParticipationSpacing({
        enabled: true,
        mode: 'BOUT_COUNT',
        regular: 2,
        medal: 5,
      }),
    })

    expect(() =>
      buildDistributedSchedules({
        boutsByMat: new Map([[1, [bout, final]]]),
        overrides: {},
        settings,
        matStartTimes: new Map([[1, matStart()]]),
        entryToAthlete: new Map([
          ['e1', 'athlete-1'],
          ['e2', 'athlete-2'],
        ]),
      }),
    ).toThrow(UnsatisfiableScheduleError)

    const plans = buildDistributedSchedulesWithFallback({
      boutsByMat: new Map([[1, [bout, final]]]),
      overrides: {},
      settings,
      matStartTimes: new Map([[1, matStart()]]),
      entryToAthlete: new Map([
        ['e1', 'athlete-1'],
        ['e2', 'athlete-2'],
      ]),
    })
    expect(plans.get(1)?.map((plan) => plan.bout.id)).toEqual(['cat::only', 'cat::final'])
  })
})
