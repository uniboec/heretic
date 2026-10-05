import { describe, expect, it } from 'vitest'
import { assertSameStageManualReorder } from '../manualOrderValidation'
import { InvalidScheduleReorderError } from '../errors'
import { makeTestBout } from './testBoutHelpers'

describe('assertSameStageManualReorder', () => {
  it('rejects cross-stage manual reorder', () => {
    const stage1 = makeTestBout({ id: 'a', categoryKey: 'cat:a', competitionStage: 1 })
    const stage2 = makeTestBout({ id: 'b', categoryKey: 'cat:b', competitionStage: 2 })
    expect(() => assertSameStageManualReorder(['b', 'a'], [stage1, stage2])).toThrow(
      InvalidScheduleReorderError,
    )
  })

  it('allows reorder within the same stage', () => {
    const a = makeTestBout({ id: 'a', categoryKey: 'cat:a', competitionStage: 2 })
    const b = makeTestBout({ id: 'b', categoryKey: 'cat:b', competitionStage: 2 })
    expect(() => assertSameStageManualReorder(['b', 'a'], [a, b])).not.toThrow()
  })

  it('allows reorder within one stage when mat has multiple stage blocks', () => {
    const s1a = makeTestBout({ id: 'a', categoryKey: 'cat:a', competitionStage: 1 })
    const s1b = makeTestBout({ id: 'b', categoryKey: 'cat:b', competitionStage: 1 })
    const s2a = makeTestBout({ id: 'c', categoryKey: 'cat:c', competitionStage: 2 })
    const s2b = makeTestBout({ id: 'd', categoryKey: 'cat:d', competitionStage: 2 })
    const bouts = [s1a, s1b, s2a, s2b]

    expect(() => assertSameStageManualReorder(['b', 'a', 'c', 'd'], bouts)).not.toThrow()
    expect(() => assertSameStageManualReorder(['a', 'b', 'd', 'c'], bouts)).not.toThrow()
  })

  it('rejects moving a bout into another stage block', () => {
    const s1a = makeTestBout({ id: 'a', categoryKey: 'cat:a', competitionStage: 1 })
    const s1b = makeTestBout({ id: 'b', categoryKey: 'cat:b', competitionStage: 1 })
    const s2a = makeTestBout({ id: 'c', categoryKey: 'cat:c', competitionStage: 2 })
    const bouts = [s1a, s1b, s2a]

    expect(() => assertSameStageManualReorder(['a', 'c', 'b'], bouts)).toThrow(
      InvalidScheduleReorderError,
    )
  })
})
