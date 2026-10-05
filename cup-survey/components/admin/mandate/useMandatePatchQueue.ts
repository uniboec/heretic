'use client'

import { useCallback, useRef } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { MandatePatchInput } from '@/lib/mandate/types'

type PatchResult = {
  check: unknown
  weightStatus: unknown
  aggregateStatus: string
  issueCount: number
}

export function useMandatePatchQueue(
  onPatched: (athleteId: string, result: PatchResult) => void,
  onError?: (athleteId: string, error: string) => void,
) {
  const queuesRef = useRef(new Map<string, Promise<void>>())
  const seqRef = useRef(new Map<string, number>())

  const enqueuePatch = useCallback(
    (athleteId: string, patch: MandatePatchInput) => {
      const previous = queuesRef.current.get(athleteId) ?? Promise.resolve()
      const next = previous
        .catch(() => undefined)
        .then(async () => {
          const seq = (seqRef.current.get(athleteId) ?? 0) + 1
          seqRef.current.set(athleteId, seq)

          const response = await fetch(
            withBasePath(`/api/admin/mandate-commission/${athleteId}`),
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patch),
            },
          )
          const result = await readJsonResponse<PatchResult & { error?: string; message?: string }>(
            response,
          )

          if (seqRef.current.get(athleteId) !== seq) return

          if (!result.ok || !response.ok) {
            onError?.(athleteId, result.data?.message ?? result.data?.error ?? 'SAVE_FAILED')
            return
          }

          onPatched(athleteId, result.data)
        })

      queuesRef.current.set(athleteId, next)
    },
    [onError, onPatched],
  )

  return { enqueuePatch }
}
