import { describe, expect, it } from 'vitest'
import { resolveBulkMoveTargetOptions } from '../resolveBulkMoveTargetOptions'

describe('resolveBulkMoveTargetOptions', () => {
  it('returns other mats when selection is on one mat', () => {
    expect(resolveBulkMoveTargetOptions([{ matIndex: 1 }, { matIndex: 1 }], 3)).toEqual([2, 3])
  })

  it('returns mats that move at least one selected bout', () => {
    expect(resolveBulkMoveTargetOptions([{ matIndex: 1 }, { matIndex: 2 }], 3)).toEqual([1, 2, 3])
  })

  it('returns empty when only one mat configured', () => {
    expect(resolveBulkMoveTargetOptions([{ matIndex: 1 }], 1)).toEqual([])
  })
})
