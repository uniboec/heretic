'use client'

import { useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'

export function usePublishedScheduleDisplayByBoutId(): Map<string, string> {
  const [scheduleDisplayByBoutId, setScheduleDisplayByBoutId] = useState(
    () => new Map<string, string>(),
  )

  useEffect(() => {
    let cancelled = false

    void fetch(withBasePath('/api/tournament/bouts'), { cache: 'no-store' })
      .then((response) =>
        readJsonResponse<{
          published?: boolean
          mats?: Array<{ bouts: Array<{ id: string; scheduleDisplayNumber: string }> }>
        }>(response),
      )
      .then((result) => {
        if (cancelled) return
        if (!result.ok || !result.data?.published) {
          setScheduleDisplayByBoutId(new Map())
          return
        }

        const displayMap = new Map<string, string>()
        for (const mat of result.data.mats ?? []) {
          for (const bout of mat.bouts) {
            displayMap.set(bout.id, bout.scheduleDisplayNumber)
          }
        }
        setScheduleDisplayByBoutId(displayMap)
      })
      .catch(() => {
        if (!cancelled) {
          setScheduleDisplayByBoutId(new Map())
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return scheduleDisplayByBoutId
}
