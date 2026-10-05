import { describe, expect, it } from 'vitest'
import {
  assertCategoryBoutIdsStable,
  BoutIdStabilityViolationError,
} from '../boutIdStability'

describe('assertCategoryBoutIdsStable', () => {
  it('allows stable bout ids when execution history exists', () => {
    expect(() =>
      assertCategoryBoutIdsStable({
        previousBoutIds: ['cat::m1', 'cat::m2'],
        nextBoutIds: ['cat::m1', 'cat::m2'],
        executions: [
          {
            boutId: 'cat::m1',
            actualStartAt: new Date(),
            actualEndAt: null,
          },
        ],
      }),
    ).not.toThrow()
  })

  it('rejects removing a started bout id', () => {
    expect(() =>
      assertCategoryBoutIdsStable({
        previousBoutIds: ['cat::m1', 'cat::m2'],
        nextBoutIds: ['cat::m2'],
        executions: [
          {
            boutId: 'cat::m1',
            actualStartAt: new Date(),
            actualEndAt: null,
          },
        ],
      }),
    ).toThrow(BoutIdStabilityViolationError)
  })
})
