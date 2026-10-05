import { describe, expect, it } from 'vitest'
import { applyMatQueueAfterOverrides } from '../applyMatQueueAfterOverrides'
import { buildPostponeCascadeOverrides } from '../postponeCascade'
import { listRunnableMatBoutIds, resolvePostponeAnchorId } from '../resolvePostponeAnchor'
import { makeTestBout } from './testBoutHelpers'

describe('postpone bout queue order', () => {
  it('moves bout after anchor even when completed bouts stay in base schedule order', () => {
    const completed = makeTestBout({ id: 'cat:a::done', categoryKey: 'cat:a' })
    const current = makeTestBout({ id: 'cat:a::current', categoryKey: 'cat:a' })
    const anchor = makeTestBout({ id: 'cat:a::anchor', categoryKey: 'cat:a' })
    const tail = makeTestBout({ id: 'cat:a::tail', categoryKey: 'cat:a' })
    const baseOrder = [completed, current, anchor, tail]
    const completedIds = new Set(['cat:a::done'])
    const runnableIds = listRunnableMatBoutIds(
      baseOrder.map((bout) => bout.id),
      completedIds,
    )

    const postponeAfterBoutId = resolvePostponeAnchorId(runnableIds, current.id, 1)
    expect(postponeAfterBoutId).toBe(anchor.id)

    const ordered = applyMatQueueAfterOverrides(baseOrder, {
      [current.id]: { queueAfterBoutId: postponeAfterBoutId },
    })
    const runnableAfter = listRunnableMatBoutIds(
      ordered.map((bout) => bout.id),
      completedIds,
    )

    expect(runnableAfter).toEqual(['cat:a::anchor', 'cat:a::current', 'cat:a::tail'])
  })

  it('keeps winner-feeder bout with postponed root', () => {
    const root = makeTestBout({ id: 'cat:a::m1', categoryKey: 'cat:a' })
    const dependent = makeTestBout({
      id: 'cat:a::m2',
      categoryKey: 'cat:a',
      sideA: {
        kind: 'hint',
        label: 'Победитель',
        source: { matchId: 'm1', outcome: 'winner' },
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
    const anchor = makeTestBout({ id: 'cat:a::anchor', categoryKey: 'cat:a' })
    const tail = makeTestBout({ id: 'cat:a::tail', categoryKey: 'cat:a' })
    const baseOrder = [root, dependent, anchor, tail]
    const runnableIds = listRunnableMatBoutIds(
      baseOrder.map((bout) => bout.id),
      new Set(),
    )

    const cascadeBoutIds = [root.id, dependent.id]
    const postponeAfterBoutId = resolvePostponeAnchorId(
      runnableIds,
      root.id,
      1,
      new Set(cascadeBoutIds),
    )
    const ordered = applyMatQueueAfterOverrides(
      baseOrder,
      buildPostponeCascadeOverrides({
        rootBoutId: root.id,
        cascadeBoutIds,
        postponeAfterBoutId,
        overrides: {},
        matBouts: baseOrder,
        runnableMatBoutIds: runnableIds,
        completedBoutIds: new Set(),
      }),
    )
    const runnableAfter = listRunnableMatBoutIds(
      ordered.map((bout) => bout.id),
      new Set(),
    )

    expect(runnableAfter).toEqual([anchor.id, root.id, dependent.id, tail.id])
  })
})
