import { describe, expect, it } from 'vitest'
import { InvalidScheduleReorderError, PinCascadeConfirmationRequiredError } from '../errors'
import { assertSameStageManualReorder } from '../manualOrderValidation'
import {
  assertPinCascadeConfirmed,
  diffOverridesForMat,
  getPinCascadeDescendantIds,
  mergeCategoryScheduleOverrides,
} from '../scheduleOverrideMutations'
import { clearManualOrderForMat } from '../scheduleOverrides'
import { makeTestBout } from './testBoutHelpers'

describe('scheduleOverrideMutations', () => {
  it('mergeCategoryScheduleOverrides removes bout override when patch is empty', () => {
    const merged = mergeCategoryScheduleOverrides(
      { a: { manualOrder: 0, pinnedToEnd: true } },
      { a: {} },
    )
    expect(merged).toEqual({})
  })

  it('getPinCascadeDescendantIds excludes already pinned bouts', () => {
    const semi = makeTestBout({ id: 'cat:a::semi', categoryKey: 'cat:a', schedulePhase: 'elimination', round: 2, roundsUntilFinal: 1 })
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
    const cascade = getPinCascadeDescendantIds('cat:a::semi', [semi, final], {
      'cat:a::final': { pinnedToEnd: true },
    })
    expect(cascade).not.toContain('cat:a::final')
  })

  it('assertPinCascadeConfirmed throws when descendants exist', () => {
    const semi = makeTestBout({ id: 'cat:a::semi', categoryKey: 'cat:a', schedulePhase: 'elimination', round: 2, roundsUntilFinal: 1 })
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
    expect(() =>
      assertPinCascadeConfirmed({
        boutId: 'cat:a::semi',
        pinnedToEnd: true,
        allBouts: [semi, final],
        overrides: {},
      }),
    ).toThrow(PinCascadeConfirmationRequiredError)
  })

  it('diffOverridesForMat captures manualOrder clears for reset', () => {
    const a = makeTestBout({ id: 'a', categoryKey: 'cat:a' })
    const b = makeTestBout({ id: 'b', categoryKey: 'cat:b' })
    const before = {
      a: { manualOrder: 0 },
      b: { manualOrder: 1 },
    }
    const after = clearManualOrderForMat([a, b], before)
    const diff = diffOverridesForMat([a, b], before, after)
    expect(diff.get('cat:a')).toEqual({ a: {} })
    expect(diff.get('cat:b')).toEqual({ b: {} })
  })

  it('rejects cross-stage manual reorder with InvalidScheduleReorderError', () => {
    const stage1 = makeTestBout({ id: 'a', categoryKey: 'cat:a', competitionStage: 1 })
    const stage2 = makeTestBout({ id: 'b', categoryKey: 'cat:b', competitionStage: 2 })
    expect(() => assertSameStageManualReorder(['b', 'a'], [stage1, stage2])).toThrow(
      InvalidScheduleReorderError,
    )
  })
})
