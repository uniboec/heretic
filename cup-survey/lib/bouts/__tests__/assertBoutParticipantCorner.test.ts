import { describe, expect, it } from 'vitest'
import { assertBoutParticipantCorner } from '../assertBoutParticipantCorner'
import { ForeignEntryIdError, ParticipantCornerMismatchError } from '../mat-control/errors'

const participants = {
  redEntryId: 'red-1',
  blueEntryId: 'blue-1',
  cornersSwapped: false,
}

describe('assertBoutParticipantCorner', () => {
  it('accepts matching entry and corner', () => {
    expect(() =>
      assertBoutParticipantCorner({ entryId: 'red-1', corner: 'red', participants }),
    ).not.toThrow()
  })

  it('rejects wrong corner for entry', () => {
    expect(() =>
      assertBoutParticipantCorner({ entryId: 'red-1', corner: 'blue', participants }),
    ).toThrow(ParticipantCornerMismatchError)
  })

  it('rejects foreign entry id', () => {
    expect(() =>
      assertBoutParticipantCorner({ entryId: 'other', corner: 'red', participants }),
    ).toThrow(ForeignEntryIdError)
  })
})
