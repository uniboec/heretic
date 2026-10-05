'use client'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { BRACKET_ACTION_LABELS, BRACKET_BACKUP_LABELS } from '@/lib/brackets/labels'
import type { BracketBackupSummary } from '@/lib/brackets/admin/types'

interface AdminBracketBackupDialogProps {
  open: boolean
  backups: BracketBackupSummary[]
  busy: boolean
  loading: boolean
  onCancel: () => void
  onCreate: () => void
  onRestore: (backupId: string) => void
}

export function AdminBracketBackupDialog({
  open,
  backups,
  busy,
  loading,
  onCancel,
  onCreate,
  onRestore,
}: AdminBracketBackupDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      layer="nested"
      size="lg"
      intent="confirm"
      ariaLabelledBy="bracket-backup-title"
    >
      <h3 id="bracket-backup-title" className="text-lg font-semibold">
        {BRACKET_BACKUP_LABELS.dialogTitle}
      </h3>
      <p className="mt-2 text-sm text-muted">{BRACKET_BACKUP_LABELS.dialogBody}</p>

      <div className="mt-4 flex justify-end">
        <Button disabled={busy || loading} onClick={onCreate}>
          {BRACKET_ACTION_LABELS.createBackup}
        </Button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted">{BRACKET_BACKUP_LABELS.loading}</p>
      ) : backups.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{BRACKET_BACKUP_LABELS.empty}</p>
      ) : (
        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {backups.map((backup) => (
            <li
              key={backup.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {backup.label ?? BRACKET_BACKUP_LABELS.unnamedBackup}
                </p>
                <p className="text-xs text-muted">
                  {new Date(backup.createdAt).toLocaleString('ru-RU')}
                  {backup.categoryCount !== undefined
                    ? ` · ${BRACKET_BACKUP_LABELS.categoryCount(backup.categoryCount)}`
                    : ''}
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => onRestore(backup.id)}
              >
                {BRACKET_ACTION_LABELS.restoreBackup}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex justify-end">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {BRACKET_BACKUP_LABELS.close}
        </Button>
      </div>
    </Modal>
  )
}
