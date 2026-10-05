import { describe, expect, it } from 'vitest'
import {
  groupByEffectiveMatIndex,
  type CategoryReleaseGroupingContext,
} from '../groupByEffectiveMatIndex'
import { makeTestBout } from './testBoutHelpers'

function bout(id: string, categoryKey = 'cat:a') {
  return makeTestBout({ id, categoryKey, categoryTitle: 'A' })
}

describe('groupByEffectiveMatIndex strict release', () => {
  it('skips Auto bouts with missing assignments instead of mat-1 fallback', () => {
    const context = new Map<string, CategoryReleaseGroupingContext>([
      [
        'cat:a',
        {
          boutsReleased: true,
          storedMatIndex: null,
          boutMatAssignments: {},
          strictRelease: true,
        },
      ],
    ])

    const grouped = groupByEffectiveMatIndex([bout('cat:a::bout-1')], 3, context)

    expect(grouped.warnings).toHaveLength(1)
    expect(grouped.warnings[0]?.code).toBe('AUTO_ASSIGNMENT_MISSING')
    expect(grouped.mats.every((mat) => mat.bouts.length === 0)).toBe(true)
  })

  it('skips Fixed bouts with out-of-range storedMatIndex in strict mode', () => {
    const stored = { ...bout('cat:a::bout-1'), storedMatIndex: 5 }
    const context = new Map<string, CategoryReleaseGroupingContext>([
      [
        'cat:a',
        {
          boutsReleased: true,
          storedMatIndex: 5,
          boutMatAssignments: null,
          strictRelease: true,
        },
      ],
    ])

    const grouped = groupByEffectiveMatIndex([stored], 3, context)

    expect(grouped.warnings[0]?.code).toBe('STORED_MAT_INDEX_OUT_OF_RANGE')
    expect(grouped.mats.every((mat) => mat.bouts.length === 0)).toBe(true)
  })

  it('still falls back to mat 1 in legacy mode when stored exceeds configured matCount', () => {
    const stored = { ...bout('cat:a::bout-1'), storedMatIndex: 5 }
    const grouped = groupByEffectiveMatIndex([stored], 3)

    expect(grouped.warnings).toHaveLength(0)
    expect(grouped.mats[4]?.bouts).toHaveLength(1)
  })
})
