import { describe, expect, it } from 'vitest'
import { applyMatQueueAfterOverrides } from '../applyMatQueueAfterOverrides'
import { applyMatQueueAfterOnRuntimeOrder } from '../matRuntimeOrder'
import { BoutsValidationError } from '../errors'
import type { BoutScheduleOverrides } from '../scheduleOverrides'
import {
  assertCascadeBeforeAnchor,
  assertRunnableOrderRespectsSportDependencies,
  buildPostponeCascadeOverrides,
  collectMatPostponeCascadeBoutIds,
  filterCascadeForPostponeAnchor,
  resolveNextActiveBoutAfterPostpone,
  shouldIncludeQueueAfterChainedBout,
} from '../postponeCascade'
import type { NormalizedBoutsPageSettings } from '../normalizeBoutsPageSettings'
import { listRunnableMatBoutIds, resolvePostponeAnchorId } from '../resolvePostponeAnchor'
import type { InternalBout } from '../types'
import { makeTestBout } from './testBoutHelpers'

const TEST_MAT_SETTINGS: NormalizedBoutsPageSettings = {
  publicEnabled: true,
  matCount: 1,
  autoMatAssignMode: 'off',
  autoMatByCategoryEnabled: false,
  boutsStartTime: '09:00',
  matStartTimeOverrides: {},
  boutBreakMinutes: 0,
  ageDivisionDurationOverrides: {},
  pinAllFinalsToEnd: false,
  competitionStageSettings: { stages: [] },
}

function filterCascadeForTest(input: {
  cascadeBoutIds: readonly string[]
  rootBoutId: string
  postponeAfterBoutId: string
  matBouts: InternalBout[]
  runnableMatBoutIds: readonly string[]
  completedBoutIds?: Set<string>
  overrides?: BoutScheduleOverrides
}) {
  const matBouts = input.matBouts.map((bout) => ({ ...bout, storedMatIndex: 1 }))
  const overrides = input.overrides ?? {}
  const orderedMatBoutsBefore = applyMatQueueAfterOverrides(matBouts, overrides)
  return filterCascadeForPostponeAnchor({
    cascadeBoutIds: input.cascadeBoutIds,
    rootBoutId: input.rootBoutId,
    postponeAfterBoutId: input.postponeAfterBoutId,
    overrides,
    groupedMats: [{ matIndex: 1, bouts: matBouts }],
    matIndex: 1,
    settings: TEST_MAT_SETTINGS,
    matBouts,
    runnableMatBoutIds: input.runnableMatBoutIds,
    completedBoutIds: input.completedBoutIds ?? new Set(),
    orderedMatBoutsBefore,
  })
}

function boutWithWinnerFeeder(input: {
  id: string
  categoryKey: string
  feederMatchId: string
}) {
  return makeTestBout({
    id: input.id,
    categoryKey: input.categoryKey,
    sideA: {
      kind: 'hint',
      label: 'Победитель',
      source: { matchId: input.feederMatchId, outcome: 'winner' },
    },
    sideB: {
      kind: 'athlete',
      entryId: `${input.id}:blue`,
      displayName: 'Синий',
      clubName: 'Клуб',
      city: 'Город',
      publicNumber: 2,
    },
  })
}

function boutWithTwoWinnerFeeders(input: {
  id: string
  categoryKey: string
  feederMatchIdA: string
  feederMatchIdB: string
}) {
  return makeTestBout({
    id: input.id,
    categoryKey: input.categoryKey,
    sideA: {
      kind: 'hint',
      label: 'Победитель 1',
      source: { matchId: input.feederMatchIdA, outcome: 'winner' },
    },
    sideB: {
      kind: 'hint',
      label: 'Победитель 2',
      source: { matchId: input.feederMatchIdB, outcome: 'winner' },
    },
  })
}

function applyPostpone(input: {
  rootBoutId: string
  matBouts: ReturnType<typeof makeTestBout>[]
  postponeBy: number
  completedBoutIds?: Set<string>
  overrides?: BoutScheduleOverrides
}) {
  const completedBoutIds = input.completedBoutIds ?? new Set<string>()
  const overrides = input.overrides ?? {}
  const orderedBefore = applyMatQueueAfterOverrides(input.matBouts, overrides)
  const runnableIds = listRunnableMatBoutIds(
    orderedBefore.map((bout) => bout.id),
    completedBoutIds,
  )
  const cascadeBoutIds = collectMatPostponeCascadeBoutIds({
    rootBoutId: input.rootBoutId,
    matBouts: input.matBouts,
    completedBoutIds,
    runnableMatBoutIds: runnableIds,
    overrides,
  })
  const postponeAfterBoutId = resolvePostponeAnchorId(
    runnableIds,
    input.rootBoutId,
    input.postponeBy,
    new Set(cascadeBoutIds),
  )
  assertCascadeBeforeAnchor({
    rootBoutId: input.rootBoutId,
    runnableMatBoutIds: runnableIds,
    anchorIndex: runnableIds.indexOf(postponeAfterBoutId),
  })
  const nextOverrides = buildPostponeCascadeOverrides({
    rootBoutId: input.rootBoutId,
    cascadeBoutIds,
    postponeAfterBoutId,
    overrides,
    matBouts: input.matBouts,
    runnableMatBoutIds: runnableIds,
    completedBoutIds,
  })
  const ordered = applyMatQueueAfterOnRuntimeOrder(orderedBefore, nextOverrides)
  const runnableAfter = listRunnableMatBoutIds(
    ordered.map((bout) => bout.id),
    completedBoutIds,
  )
  assertRunnableOrderRespectsSportDependencies({
    matBouts: input.matBouts,
    runnableBoutIds: runnableAfter,
    completedBoutIds,
  })
  return { cascadeBoutIds, postponeAfterBoutId, runnableAfter, overrides: nextOverrides, ordered }
}

describe('postponeCascade', () => {
  it('collects transitive dependent bouts on the mat in queue order', () => {
    const root = makeTestBout({ id: 'cat:a::m1', categoryKey: 'cat:a' })
    const dependent = boutWithWinnerFeeder({
      id: 'cat:a::m2',
      categoryKey: 'cat:a',
      feederMatchId: 'm1',
    })
    const transitive = boutWithWinnerFeeder({
      id: 'cat:a::m3',
      categoryKey: 'cat:a',
      feederMatchId: 'm2',
    })
    const unrelated = makeTestBout({ id: 'cat:a::other', categoryKey: 'cat:a' })
    const matBouts = [root, dependent, unrelated, transitive]
    const runnableMatBoutIds = matBouts.map((bout) => bout.id)

    expect(
      collectMatPostponeCascadeBoutIds({
        rootBoutId: root.id,
        matBouts,
        completedBoutIds: new Set(),
        runnableMatBoutIds,
      }),
    ).toEqual([root.id, dependent.id, transitive.id])
  })

  it('includes joint feeder bouts when only one predecessor is postponed', () => {
    const m1 = makeTestBout({ id: 'cat:a::bout-1', categoryKey: 'cat:a' })
    const m2 = makeTestBout({ id: 'cat:a::bout-2', categoryKey: 'cat:a' })
    const semi = boutWithTwoWinnerFeeders({
      id: 'cat:a::bout-3',
      categoryKey: 'cat:a',
      feederMatchIdA: 'bout-1',
      feederMatchIdB: 'bout-2',
    })
    const tail = makeTestBout({ id: 'cat:a::tail', categoryKey: 'cat:a' })
    const matBouts = [m1, m2, semi, tail]

    expect(
      collectMatPostponeCascadeBoutIds({
        rootBoutId: m1.id,
        matBouts,
        completedBoutIds: new Set(),
        runnableMatBoutIds: matBouts.map((bout) => bout.id),
      }),
    ).toEqual([m1.id, semi.id])
  })

  it('does not pull unrelated categories through transitive queueAfter links', () => {
    const root = makeTestBout({ id: 'cat:a::root', categoryKey: 'cat:a' })
    const chainedSameCat = makeTestBout({ id: 'cat:a::chained', categoryKey: 'cat:a' })
    const anchoredOtherCat = makeTestBout({ id: 'cat:b::anchored', categoryKey: 'cat:b' })
    const foreignBlock = makeTestBout({ id: 'cat:c::foreign', categoryKey: 'cat:c' })
    const matBouts = [root, chainedSameCat, anchoredOtherCat, foreignBlock]

    expect(
      collectMatPostponeCascadeBoutIds({
        rootBoutId: root.id,
        matBouts,
        completedBoutIds: new Set(),
        runnableMatBoutIds: matBouts.map((bout) => bout.id),
        overrides: {
          [anchoredOtherCat.id]: { queueAfterBoutId: root.id },
          [chainedSameCat.id]: { queueAfterBoutId: anchoredOtherCat.id },
          [foreignBlock.id]: { queueAfterBoutId: anchoredOtherCat.id },
        },
      }),
    ).toEqual([root.id, anchoredOtherCat.id])
  })

  it('filterCascadeForPostponeAnchor drops late bracket rounds with external feeders', () => {
    const m1 = makeTestBout({ id: 'cat:a::bout-1', categoryKey: 'cat:a' })
    const m10 = makeTestBout({ id: 'cat:a::bout-10', categoryKey: 'cat:a' })
    const semi = boutWithTwoWinnerFeeders({
      id: 'cat:a::bout-13',
      categoryKey: 'cat:a',
      feederMatchIdA: 'bout-1',
      feederMatchIdB: 'bout-10',
    })
    const anchor = makeTestBout({ id: 'cat:a::anchor', categoryKey: 'cat:a' })
    const matBouts = [m1, anchor, m10, semi]
    const runnableIds = matBouts.map((bout) => bout.id)

    expect(
      filterCascadeForTest({
        cascadeBoutIds: [m1.id, semi.id],
        rootBoutId: m1.id,
        postponeAfterBoutId: anchor.id,
        matBouts,
        runnableMatBoutIds: runnableIds,
      }),
    ).toEqual([m1.id])
  })

  it('shouldIncludeQueueAfterChainedBout allows root anchor across categories', () => {
    expect(
      shouldIncludeQueueAfterChainedBout({
        boutCategoryKey: 'cat:b',
        queueAfterBoutId: 'cat:a::root',
        rootBoutId: 'cat:a::root',
        anchorCategoryKey: 'cat:a',
      }),
    ).toBe(true)
    expect(
      shouldIncludeQueueAfterChainedBout({
        boutCategoryKey: 'cat:c',
        queueAfterBoutId: 'cat:b::anchored',
        rootBoutId: 'cat:a::root',
        anchorCategoryKey: 'cat:b',
      }),
    ).toBe(false)
  })

  it('includes bouts chained via previous queueAfter overrides', () => {
    const m1 = makeTestBout({ id: 'cat:a::bout-1', categoryKey: 'cat:a' })
    const m2 = makeTestBout({ id: 'cat:a::bout-2', categoryKey: 'cat:a' })
    const semi = boutWithTwoWinnerFeeders({
      id: 'cat:a::bout-3',
      categoryKey: 'cat:a',
      feederMatchIdA: 'bout-1',
      feederMatchIdB: 'bout-2',
    })
    const matBouts = [m1, m2, semi]

    expect(
      collectMatPostponeCascadeBoutIds({
        rootBoutId: m2.id,
        matBouts,
        completedBoutIds: new Set(),
        runnableMatBoutIds: matBouts.map((bout) => bout.id),
        overrides: { [m1.id]: { queueAfterBoutId: m2.id } },
      }),
    ).toEqual([m2.id, m1.id, semi.id])
  })

  it('chains dependent bouts immediately after the postponed root', () => {
    const root = makeTestBout({ id: 'cat:a::m1', categoryKey: 'cat:a' })
    const dependent = boutWithWinnerFeeder({
      id: 'cat:a::m2',
      categoryKey: 'cat:a',
      feederMatchId: 'm1',
    })
    const anchor = makeTestBout({ id: 'cat:a::anchor', categoryKey: 'cat:a' })
    const tail = makeTestBout({ id: 'cat:a::tail', categoryKey: 'cat:a' })
    const matBouts = [root, dependent, anchor, tail]

    const { cascadeBoutIds, runnableAfter } = applyPostpone({
      rootBoutId: root.id,
      matBouts,
      postponeBy: 1,
    })

    expect(cascadeBoutIds).toEqual([root.id, dependent.id])
    expect(runnableAfter).toEqual([anchor.id, root.id, dependent.id, tail.id])
  })

  it('keeps winner-1 vs winner-2 bout after postponed feeder block', () => {
    const m1 = makeTestBout({ id: 'cat:a::bout-1', categoryKey: 'cat:a' })
    const m2 = makeTestBout({ id: 'cat:a::bout-2', categoryKey: 'cat:a' })
    const semi = boutWithTwoWinnerFeeders({
      id: 'cat:a::bout-3',
      categoryKey: 'cat:a',
      feederMatchIdA: 'bout-1',
      feederMatchIdB: 'bout-2',
    })
    const anchor = makeTestBout({ id: 'cat:a::anchor', categoryKey: 'cat:a' })
    const tail = makeTestBout({ id: 'cat:a::tail', categoryKey: 'cat:a' })
    const matBouts = [m1, m2, semi, anchor, tail]

    const { cascadeBoutIds, runnableAfter } = applyPostpone({
      rootBoutId: m1.id,
      matBouts,
      postponeBy: 2,
    })

    expect(cascadeBoutIds).toEqual([m1.id, semi.id])
    expect(runnableAfter).toEqual([m2.id, anchor.id, m1.id, semi.id, tail.id])
  })

  it('keeps chained block together across repeated postpones', () => {
    const m1 = makeTestBout({ id: 'cat:a::bout-1', categoryKey: 'cat:a' })
    const m2 = makeTestBout({ id: 'cat:a::bout-2', categoryKey: 'cat:a' })
    const semi = boutWithTwoWinnerFeeders({
      id: 'cat:a::bout-3',
      categoryKey: 'cat:a',
      feederMatchIdA: 'bout-1',
      feederMatchIdB: 'bout-2',
    })
    const other = makeTestBout({ id: 'cat:a::other', categoryKey: 'cat:a' })
    const tail = makeTestBout({ id: 'cat:a::tail', categoryKey: 'cat:a' })
    const matBouts = [m1, m2, semi, other, tail]

    const first = applyPostpone({ rootBoutId: m1.id, matBouts, postponeBy: 1 })
    expect(first.cascadeBoutIds).toEqual([m1.id, semi.id])
    expect(first.runnableAfter).toEqual([m2.id, m1.id, semi.id, other.id, tail.id])

    const second = applyPostpone({
      rootBoutId: m2.id,
      matBouts,
      postponeBy: 1,
      overrides: first.overrides,
    })
    expect(second.cascadeBoutIds).toEqual([m2.id, m1.id, semi.id])
    expect(second.runnableAfter).toEqual([other.id, m2.id, m1.id, semi.id, tail.id])
  })

  it('rejects postpone when root is not before anchor', () => {
    const m1 = makeTestBout({ id: 'cat:a::m1', categoryKey: 'cat:a' })
    const m2 = makeTestBout({ id: 'cat:a::m2', categoryKey: 'cat:a' })
    const runnableIds = [m1.id, m2.id]

    expect(() =>
      assertCascadeBeforeAnchor({
        rootBoutId: m1.id,
        runnableMatBoutIds: runnableIds,
        anchorIndex: 0,
      }),
    ).toThrow(BoutsValidationError)
  })

  it('skips dependency-blocked bout when choosing next active bout', () => {
    const m1 = makeTestBout({ id: 'cat:a::bout-1', categoryKey: 'cat:a' })
    const blocked = boutWithWinnerFeeder({
      id: 'cat:a::bout-2',
      categoryKey: 'cat:a',
      feederMatchId: 'bout-1',
    })
    const ready = makeTestBout({
      id: 'cat:a::ready',
      categoryKey: 'cat:a',
      sideA: {
        kind: 'athlete',
        entryId: 'cat:a::red',
        displayName: 'Красный',
        clubName: 'Клуб',
        city: 'Город',
        publicNumber: 1,
      },
      sideB: {
        kind: 'athlete',
        entryId: 'cat:a::blue',
        displayName: 'Синий',
        clubName: 'Клуб',
        city: 'Город',
        publicNumber: 2,
      },
    })

    const nextActive = resolveNextActiveBoutAfterPostpone({
      orderedBouts: [ready, m1, blocked],
      cascadeBoutIdSet: new Set([m1.id]),
      completedBoutIds: new Set(),
      restUntilByEntryId: new Map(),
      now: new Date(),
    })

    expect(nextActive).toBe(ready.id)
  })

  it('keeps same-category sport dependents when postponing a chained root bout', () => {
    const m1 = makeTestBout({ id: 'cat:a::bout-1', categoryKey: 'cat:a' })
    const m2 = boutWithWinnerFeeder({
      id: 'cat:a::bout-2',
      categoryKey: 'cat:a',
      feederMatchId: 'bout-1',
    })
    const semi = boutWithWinnerFeeder({
      id: 'cat:a::bout-3',
      categoryKey: 'cat:a',
      feederMatchId: 'bout-2',
    })
    const anchor = makeTestBout({ id: 'cat:b::anchor', categoryKey: 'cat:b' })
    const tail = makeTestBout({ id: 'cat:b::tail', categoryKey: 'cat:b' })
    const matBouts = [m1, m2, semi, anchor, tail]

    const { cascadeBoutIds, runnableAfter } = applyPostpone({
      rootBoutId: m1.id,
      matBouts,
      postponeBy: 1,
      overrides: {
        [m2.id]: { queueAfterBoutId: m1.id },
        [semi.id]: { queueAfterBoutId: m2.id },
      },
    })

    expect(cascadeBoutIds).toEqual([m1.id, m2.id, semi.id])
    expect(runnableAfter).toEqual([anchor.id, m1.id, m2.id, semi.id, tail.id])
  })

  it('survives three olympic-style postpones without breaking feeder order', () => {
    const m1 = makeTestBout({ id: 'cat:a::bout-1', categoryKey: 'cat:a' })
    const m2 = makeTestBout({ id: 'cat:a::bout-2', categoryKey: 'cat:a' })
    const semi = boutWithTwoWinnerFeeders({
      id: 'cat:a::bout-3',
      categoryKey: 'cat:a',
      feederMatchIdA: 'bout-1',
      feederMatchIdB: 'bout-2',
    })
    const other = makeTestBout({ id: 'cat:a::other', categoryKey: 'cat:a' })
    const tail = makeTestBout({ id: 'cat:a::tail', categoryKey: 'cat:a' })
    const matBouts = [m1, m2, semi, other, tail]

    const first = applyPostpone({ rootBoutId: m1.id, matBouts, postponeBy: 1 })
    const second = applyPostpone({
      rootBoutId: m2.id,
      matBouts,
      postponeBy: 1,
      overrides: first.overrides,
    })
    const third = applyPostpone({
      rootBoutId: m1.id,
      matBouts,
      postponeBy: 1,
      overrides: second.overrides,
    })

    expect(third.runnableAfter.indexOf(semi.id)).toBeGreaterThan(
      third.runnableAfter.indexOf(m1.id),
    )
    expect(third.runnableAfter.indexOf(semi.id)).toBeGreaterThan(
      third.runnableAfter.indexOf(m2.id),
    )
    assertRunnableOrderRespectsSportDependencies({
      matBouts,
      runnableBoutIds: third.runnableAfter,
      completedBoutIds: new Set(),
    })
  })
})
