import { describe, expect, it } from 'vitest'
import { isAdminCategoryExportCandidate } from '../exportCandidates'

describe('exportCandidates', () => {
  it('accepts ACTIVE categories with participants regardless of public visibility', () => {
    expect(
      isAdminCategoryExportCandidate({
        status: 'ACTIVE',
        participants: [{ entryId: '1' }],
      }),
    ).toBe(true)
    expect(
      isAdminCategoryExportCandidate({
        status: 'ACTIVE',
        participants: [],
      }),
    ).toBe(false)
    expect(
      isAdminCategoryExportCandidate({
        status: 'INACTIVE',
        participants: [{ entryId: '1' }],
      }),
    ).toBe(false)
  })
})
