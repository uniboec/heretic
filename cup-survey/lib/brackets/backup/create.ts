import { prisma } from '../../prisma'
import { BracketOperationError } from '../core/errors'
import { requireWorkingGeneration } from '../live/generation'
import { BACKUP_SCHEMA_VERSION, buildBackupSnapshot } from './snapshot'

export async function createBracketBackup(label?: string): Promise<{
  ok: true
  backup: { id: string; label: string | null; createdAt: string }
}> {
  const working = await requireWorkingGeneration()
  const snapshot = await buildBackupSnapshot(working.id)

  const row = await prisma.bracketBackup.create({
    data: {
      label: label?.trim() || null,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      snapshot,
    },
  })

  if (!row) {
    throw new BracketOperationError('BACKUP_CREATE_FAILED', 'Не удалось создать резервную копию')
  }

  return {
    ok: true,
    backup: {
      id: row.id,
      label: row.label,
      createdAt: row.createdAt.toISOString(),
    },
  }
}
