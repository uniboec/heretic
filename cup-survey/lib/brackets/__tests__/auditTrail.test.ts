import { describe, expect, it } from 'vitest'

interface AuditRow {
  action: 'MOVE' | 'RESET'
  fromCategoryKey: string
  toCategoryKey: string
}

function buildAuditChain(rows: AuditRow[]) {
  return rows.map((row, index) => ({
    step: index + 1,
    from: row.fromCategoryKey,
    to: row.toCategoryKey,
    action: row.action,
  }))
}

describe('audit trail A→B→C', () => {
  it('preserves ordered move history', () => {
    const chain = buildAuditChain([
      { action: 'MOVE', fromCategoryKey: 'cat-a', toCategoryKey: 'cat-b' },
      { action: 'MOVE', fromCategoryKey: 'cat-b', toCategoryKey: 'cat-c' },
    ])
    expect(chain).toHaveLength(2)
    expect(chain[0]).toMatchObject({ from: 'cat-a', to: 'cat-b' })
    expect(chain[1]).toMatchObject({ from: 'cat-b', to: 'cat-c' })
  })

  it('reset returns to source category', () => {
    const chain = buildAuditChain([
      { action: 'MOVE', fromCategoryKey: 'cat-a', toCategoryKey: 'cat-b' },
      { action: 'RESET', fromCategoryKey: 'cat-b', toCategoryKey: 'cat-a' },
    ])
    expect(chain[1].action).toBe('RESET')
    expect(chain[1].to).toBe('cat-a')
  })
})
