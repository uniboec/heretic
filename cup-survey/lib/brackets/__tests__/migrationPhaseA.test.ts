import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Migration A schema expansion', () => {
  const migrationSql = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260926120000_bracket_active_migration_a/migration.sql'),
    'utf8',
  )

  it('adds ACTIVE enum value without removing legacy values', () => {
    expect(migrationSql).toContain("'ACTIVE'")
    expect(migrationSql).not.toMatch(/DROP TYPE.*BracketGenerationStatus/i)
  })

  it('adds BracketBackup and BracketCutoverCheckpoint tables', () => {
    expect(migrationSql).toContain('BracketBackup')
    expect(migrationSql).toContain('BracketCutoverCheckpoint')
  })

  it('renames BracketAutoSyncEvent draftGenerationId to generationId', () => {
    expect(migrationSql).toContain('generationId')
    expect(migrationSql).toContain('DROP COLUMN IF EXISTS "draftGenerationId"')
  })
})
