import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Migration B enum finalization', () => {
  const migrationSql = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260926130000_bracket_active_migration_b/migration.sql'),
    'utf8',
  )

  it('recreates BracketGenerationStatus with ACTIVE only', () => {
    expect(migrationSql).toMatch(/BracketGenerationStatus_new|ACTIVE/i)
    expect(migrationSql).toMatch(/AS ENUM \('ACTIVE'\)/)
  })

  it('drops legacy single-draft index before enum finalization', () => {
    expect(migrationSql).toMatch(/DROP INDEX IF EXISTS "bracket_generation_single_draft"/)
  })

  it('makes singletonKey NOT NULL with default live', () => {
    expect(migrationSql).toMatch(/singletonKey.*NOT NULL/i)
    expect(migrationSql).toContain("'live'")
  })
})
