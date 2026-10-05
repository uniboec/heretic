'use client'

import { useCallback, useState } from 'react'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import {
  fetchRegistrationImpactPreview,
  requiresRegistrationImpactConfirm,
  type RegistrationImpactPreview,
} from '@/lib/registration/adminImpact'
import type { CategoryLockLevel } from '@/lib/brackets/live/guard'
import { formatBracketConflictMessage } from '@/lib/brackets/labels'

export type RegistrationImpactConfirmState = {
  title: string
  body: string
  impactToken: string
  affectedCategoryKeys: string[]
  lockLevels: Record<string, CategoryLockLevel>
  totalCategoryCount: number
  commit: (impactToken: string) => Promise<boolean>
}

export function useRegistrationImpactFlow() {
  const [confirm, setConfirm] = useState<RegistrationImpactConfirmState | null>(null)
  const [loading, setLoading] = useState(false)

  const runWithImpact = useCallback(
    async (input: {
      registrationId?: string
      mutationFingerprint?: string
      categoryKeys?: string[]
      entryIds?: string[]
      impactOperation?: 'admin_registration_mutation' | 'standalone_force_rebuild'
      title: string
      body: string
      execute: (impactToken?: string) => Promise<Response>
    }): Promise<boolean> => {
      const impactOperation = input.impactOperation ?? 'admin_registration_mutation'
      const preview = await fetchRegistrationImpactPreview({
        registrationId: input.registrationId,
        mutationFingerprint: input.mutationFingerprint,
        categoryKeys: input.categoryKeys,
        entryIds: input.entryIds,
        operation: impactOperation,
      })

      if (!preview.ok) {
        window.alert(preview.message)
        return false
      }

      const needsConfirm = requiresRegistrationImpactConfirm(preview.data.lockLevels)

      const executeOnce = async (impactToken?: string): Promise<boolean> => {
        const response = await input.execute(impactToken)
        const parsed = await readJsonResponse<Record<string, unknown>>(response.clone())
        const body = parsed.ok ? parsed.data : parsed.body
        if (response.ok) return true

        const code =
          body && typeof body === 'object' && 'code' in body
            ? String((body as { code?: string }).code)
            : undefined

        if (code === 'IMPACT_CHANGED') {
          const refreshed = await fetchRegistrationImpactPreview({
            registrationId: input.registrationId,
            mutationFingerprint: input.mutationFingerprint,
            categoryKeys: input.categoryKeys,
            entryIds: input.entryIds,
            operation: impactOperation,
          })
          if (refreshed.ok && requiresRegistrationImpactConfirm(refreshed.data.lockLevels)) {
            setConfirm({
              title: input.title,
              body: input.body,
              impactToken: refreshed.data.impactToken,
              affectedCategoryKeys: refreshed.data.affectedCategoryKeys,
              lockLevels: refreshed.data.lockLevels,
              totalCategoryCount: refreshed.data.totalCategoryCount,
              commit: executeOnce,
            })
          } else {
            window.alert(formatBracketConflictMessage('IMPACT_CHANGED'))
            setConfirm(null)
          }
          return false
        }

        if (code === 'DESTRUCTIVE_CONFIRM_REQUIRED') {
          setConfirm({
            title: input.title,
            body: input.body,
            impactToken: preview.data.impactToken,
            affectedCategoryKeys: preview.data.affectedCategoryKeys,
            lockLevels: preview.data.lockLevels,
            totalCategoryCount: preview.data.totalCategoryCount,
            commit: executeOnce,
          })
          return false
        }

        const message =
          body && typeof body === 'object' && 'error' in body
            ? String((body as { error?: string }).error)
            : 'Ошибка операции'
        window.alert(message)
        return false
      }

      if (!needsConfirm) {
        return executeOnce(undefined)
      }

      return new Promise((resolve) => {
        setConfirm({
          title: input.title,
          body: input.body,
          impactToken: preview.data.impactToken,
          affectedCategoryKeys: preview.data.affectedCategoryKeys,
          lockLevels: preview.data.lockLevels,
          totalCategoryCount: preview.data.totalCategoryCount,
          commit: async (impactToken) => {
            const ok = await executeOnce(impactToken)
            resolve(ok)
            return ok
          },
        })
      })
    },
    [],
  )

  const confirmImpact = useCallback(async () => {
    if (!confirm) return
    setLoading(true)
    try {
      const ok = await confirm.commit(confirm.impactToken)
      if (ok) setConfirm(null)
    } finally {
      setLoading(false)
    }
  }, [confirm])

  return {
    confirm,
    loading,
    setConfirm,
    runWithImpact,
    confirmImpact,
  }
}
