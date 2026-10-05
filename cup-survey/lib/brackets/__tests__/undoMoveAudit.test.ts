import { describe, expect, it } from 'vitest'

function canUndoMoveAudit(params: {
  auditId: string
  entryId: string
  toCategoryKey: string
  latestAuditIdByEntry: Map<string, string>
  currentCategoryKey: string
}): boolean {
  const isLatest = params.latestAuditIdByEntry.get(params.entryId) === params.auditId
  const stateMatches = params.currentCategoryKey === params.toCategoryKey
  return isLatest && stateMatches
}

describe('canUndoMoveAudit', () => {
  const latest = new Map([['entry-1', 'audit-2']])

  it('allows undo for latest matching record', () => {
    expect(
      canUndoMoveAudit({
        auditId: 'audit-2',
        entryId: 'entry-1',
        toCategoryKey: 'cat-b',
        latestAuditIdByEntry: latest,
        currentCategoryKey: 'cat-b',
      }),
    ).toBe(true)
  })

  it('rejects undo for older record in chain', () => {
    expect(
      canUndoMoveAudit({
        auditId: 'audit-1',
        entryId: 'entry-1',
        toCategoryKey: 'cat-b',
        latestAuditIdByEntry: latest,
        currentCategoryKey: 'cat-c',
      }),
    ).toBe(false)
  })

  it('rejects undo when state changed after action', () => {
    expect(
      canUndoMoveAudit({
        auditId: 'audit-2',
        entryId: 'entry-1',
        toCategoryKey: 'cat-b',
        latestAuditIdByEntry: latest,
        currentCategoryKey: 'cat-c',
      }),
    ).toBe(false)
  })
})
