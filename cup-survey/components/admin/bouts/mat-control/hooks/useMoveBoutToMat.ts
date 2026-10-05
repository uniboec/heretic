'use client'

import { useCallback } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'
import { createOperationId } from '../judge/judgeUtils'

export function useMoveBoutToMat({
  holderToken,
  activeBout,
  refresh,
  setBusy,
  setError,
}: {
  holderToken: string | null
  activeBout: MatControlSnapshot['activeBout']
  refresh: () => Promise<MatControlSnapshot | null>
  setBusy: (busy: boolean) => void
  setError: (error: string | null) => void
}) {
  const moveBoutToMat = useCallback(
    async (targetMatIndex: number) => {
      if (!holderToken) {
        setError('Захватите управление ковром')
        return false
      }

      if (!activeBout) {
        setError('Нет поединка для переноса')
        return false
      }

      setBusy(true)
      setError(null)

      try {
        const res = await fetch(
          withBasePath(`/api/admin/bouts/${encodeURIComponent(activeBout.boutId)}/move-mat`),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operationId: createOperationId(),
              holderToken,
              expectedLiveRevision: activeBout.execution.liveRevision,
              expectedAttemptNumber: activeBout.execution.attemptNumber,
              targetMatIndex,
            }),
          },
        )
        const result = await readJsonResponse<{ error?: string }>(res)
        if (!result.ok) {
          setError(result.error ?? 'Не удалось перенести поединок на другой ковёр')
          return false
        }

        await refresh()
        return true
      } finally {
        setBusy(false)
      }
    },
    [activeBout, holderToken, refresh, setBusy, setError],
  )

  return { moveBoutToMat }
}
