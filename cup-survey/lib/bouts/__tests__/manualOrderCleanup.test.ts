import { describe, expect, it } from 'vitest'
import { clearManualOrderOverridesForBoutIds } from '../manualOrderCleanup'
import { makeTestBout } from './testBoutHelpers'

describe('clearManualOrderOverridesForBoutIds', () => {
  it('clears manual order only for targeted bout ids', () => {
    const stage1 = makeTestBout({ id: 'a', categoryKey: 'cat:a', competitionStage: 1 })
    const stage2 = makeTestBout({ id: 'b', categoryKey: 'cat:a', competitionStage: 2 })
    const other = makeTestBout({ id: 'c', categoryKey: 'cat:b', competitionStage: 2 })

    const next = clearManualOrderOverridesForBoutIds(
      [stage1, stage2, other],
      new Set(['a', 'b']),
      {
        a: { manualOrder: 0 },
        b: { manualOrder: 1, pinnedToEnd: true },
        c: { manualOrder: 2 },
      },
    )

    expect(next.a).toBeUndefined()
    expect(next.b).toEqual({ pinnedToEnd: true })
    expect(next.c).toEqual({ manualOrder: 2 })
  })
})
