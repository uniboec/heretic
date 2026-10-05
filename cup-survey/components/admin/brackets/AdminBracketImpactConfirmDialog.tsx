'use client'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { CategoryLockLevel } from '@/lib/brackets/live/guard'
import { BRACKET_IMPACT_CONFIRM, BRACKET_LOCK_LEVEL_LABELS } from '@/lib/brackets/labels'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { cn } from '@/lib/cn'

interface AdminBracketImpactConfirmDialogProps {
  open: boolean
  title: string
  body: string
  affectedCount: number
  totalCount: number
  affectedCategories?: Array<{ categoryKey: string; lockLevel: CategoryLockLevel }>
  busy: boolean
  loading: boolean
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

function lockBadgeClass(level: CategoryLockLevel): string {
  if (level === 'RELEASED') return 'bg-warning-soft text-warning-foreground border-warning-border'
  if (level === 'PLAYED') return 'bg-danger-soft text-danger-foreground border-danger-border'
  return 'bg-muted/30 text-muted border-border'
}

export function AdminBracketImpactConfirmDialog({
  open,
  title,
  body,
  affectedCount,
  totalCount,
  affectedCategories = [],
  busy,
  loading,
  confirmLabel,
  onCancel,
  onConfirm,
}: AdminBracketImpactConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      layer="nested"
      size="md"
      intent="confirm"
      ariaLabelledBy="bracket-impact-confirm-title"
    >
      <h3 id="bracket-impact-confirm-title" className="text-lg font-semibold">
        {title}
      </h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <p className="mt-3 text-sm font-medium">
        {BRACKET_IMPACT_CONFIRM.categoriesAffected(affectedCount, totalCount)}
      </p>
      {affectedCategories.length > 0 && (
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
          {affectedCategories.map(({ categoryKey, lockLevel }) => (
            <li
              key={categoryKey}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <span className="min-w-0">{getCategoryTitleFromKey(categoryKey)}</span>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium',
                  lockBadgeClass(lockLevel),
                )}
              >
                {BRACKET_LOCK_LEVEL_LABELS[lockLevel]}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" disabled={busy || loading} onClick={onCancel}>
          {BRACKET_IMPACT_CONFIRM.cancel}
        </Button>
        <Button disabled={busy || loading || affectedCount === 0} onClick={onConfirm}>
          {loading
            ? BRACKET_IMPACT_CONFIRM.loading
            : (confirmLabel ?? BRACKET_IMPACT_CONFIRM.confirm)}
        </Button>
      </div>
    </Modal>
  )
}
