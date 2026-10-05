'use client'

import { useCallback } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'
import { createOperationId } from '../judge/judgeUtils'

export function usePostponeBout({
  holderToken,
  activeBout,
  scheduleVersion,
  refresh,
  setBusy,
  setError,
}: {
  holderToken: string | null
  activeBout: MatControlSnapshot['activeBout']
  scheduleVersion: number
  refresh: () => Promise<MatControlSnapshot | null>
  setBusy: (busy: boolean) => void
  setError: (error: string | null) => void
}) {
  const postponeBout = useCallback(
    async (postponeBy: number) => {
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
        const operationId = createOperationId()
        let currentScheduleVersion = scheduleVersion
        let scheduleRetries = 0

        while (true) {
          const res = await fetch(
            withBasePath(`/api/admin/bouts/${encodeURIComponent(activeBout.boutId)}/postpone`),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operationId,
                holderToken,
                expectedLiveRevision: activeBout.execution.liveRevision,
                expectedAttemptNumber: activeBout.execution.attemptNumber,
                expectedScheduleVersion: currentScheduleVersion,
                postponeBy,
              }),
            },
          )
          const result = await readJsonResponse<{ error?: string; code?: string }>(res)
          if (result.ok) {
            await refresh()
            return true
          }

          const errorCode =
            result.body && typeof result.body === 'object' && 'code' in result.body
              ? String((result.body as { code?: string }).code ?? '')
              : ''

          if (errorCode === 'SCHEDULE_VERSION_CONFLICT' && scheduleRetries < 1) {
            scheduleRetries += 1
            const fresh = await refresh()
            if (typeof fresh?.scheduleVersion === 'number') {
              currentScheduleVersion = fresh.scheduleVersion
            }
            continue
          }

          setError(result.error ?? 'Не удалось перенести поединок')
          return false
        }
      } finally {
        setBusy(false)
      }
    },
    [activeBout, holderToken, refresh, scheduleVersion, setBusy, setError],
  )

  return { postponeBout }
}
