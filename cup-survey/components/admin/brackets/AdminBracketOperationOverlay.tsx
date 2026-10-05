'use client'

import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { adminPanel } from '@/lib/ui/adminSurfaceStyles'
import { BRACKET_OPERATION_LABELS } from '@/lib/brackets/labels'
import type { BracketOperationKind } from './AdminBracketOperationOverlay.types'

export type { BracketOperationKind } from './AdminBracketOperationOverlay.types'

interface AdminBracketOperationOverlayProps {
  operation: BracketOperationKind
}

export function AdminBracketOperationOverlay({ operation }: AdminBracketOperationOverlayProps) {
  if (!operation) return null

  const title = BRACKET_OPERATION_LABELS[operation]

  return (
    <Modal
      open
      onClose={() => {}}
      dismissible={false}
      layer="nested"
      size="sm"
      panelClassName={cn(adminPanel, 'border-0 p-0 shadow-xl')}
      ariaLabelledBy="bracket-operation-title"
    >
      <div className="p-6 text-center">
        <div
          className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent"
          aria-hidden="true"
        />
        <p id="bracket-operation-title" className="text-base font-semibold">{title}</p>
        <p className="mt-2 text-sm text-muted">{BRACKET_OPERATION_LABELS.hint}</p>
      </div>
    </Modal>
  )
}
