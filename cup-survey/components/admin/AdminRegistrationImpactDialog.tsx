'use client'

import { AdminBracketImpactConfirmDialog } from './brackets/AdminBracketImpactConfirmDialog'
import type { RegistrationImpactConfirmState } from './useRegistrationImpactFlow'

interface AdminRegistrationImpactDialogProps {
  open: boolean
  state: RegistrationImpactConfirmState
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AdminRegistrationImpactDialog({
  open,
  state,
  loading,
  onCancel,
  onConfirm,
}: AdminRegistrationImpactDialogProps) {
  return (
    <AdminBracketImpactConfirmDialog
      open={open}
      title={state.title}
      body={state.body}
      affectedCount={state.affectedCategoryKeys.length}
      totalCount={state.totalCategoryCount}
      affectedCategories={state.affectedCategoryKeys.map((categoryKey) => ({
        categoryKey,
        lockLevel: state.lockLevels[categoryKey] ?? 'OPEN',
      }))}
      busy={loading}
      loading={loading}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
