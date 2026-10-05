import { describe, expect, it } from 'vitest'
import { computeLegacyReleaseFields } from '../legacyReleaseGate'

describe('computeLegacyReleaseFields', () => {
  it('visible=false clears release fields', () => {
    expect(
      computeLegacyReleaseFields({
        visible: false,
        storedMatIndex: 1,
        matCount: 2,
        autoBoutIds: ['a::1'],
      }),
    ).toEqual({
      boutsReleased: false,
      boutMatAssignments: null,
      matCountAtRelease: null,
    })
  })

  it('Auto visible with matCount>=1 releases to mat 1', () => {
    expect(
      computeLegacyReleaseFields({
        visible: true,
        storedMatIndex: null,
        matCount: 3,
        autoBoutIds: ['cat::m1', 'cat::m2'],
      }),
    ).toEqual({
      boutsReleased: true,
      boutMatAssignments: { 'cat::m1': 1, 'cat::m2': 1 },
      matCountAtRelease: 3,
    })
  })

  it('Auto visible with matCount<1 stays unreleased', () => {
    expect(
      computeLegacyReleaseFields({
        visible: true,
        storedMatIndex: null,
        matCount: 0,
        autoBoutIds: ['cat::m1'],
      }),
    ).toEqual({
      boutsReleased: false,
      boutMatAssignments: null,
      matCountAtRelease: null,
    })
  })

  it('Fixed out-of-range stays unreleased while visible can remain true elsewhere', () => {
    expect(
      computeLegacyReleaseFields({
        visible: true,
        storedMatIndex: 3,
        matCount: 2,
        autoBoutIds: [],
      }),
    ).toEqual({
      boutsReleased: false,
      boutMatAssignments: null,
      matCountAtRelease: null,
    })
  })

  it('Fixed in range releases without assignments', () => {
    expect(
      computeLegacyReleaseFields({
        visible: true,
        storedMatIndex: 2,
        matCount: 3,
        autoBoutIds: [],
      }),
    ).toEqual({
      boutsReleased: true,
      boutMatAssignments: null,
      matCountAtRelease: 3,
    })
  })
})
