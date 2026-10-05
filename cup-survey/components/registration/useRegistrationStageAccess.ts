'use client'

import { useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'

type AccessState = {
  loaded: boolean
  closed: boolean
  /** True while an registration stage is active (payment/edit allowed). */
  stageOpen: boolean
}

export function useRegistrationStageAccess(): AccessState {
  const [access, setAccess] = useState<AccessState>({
    loaded: false,
    closed: false,
    stageOpen: false,
  })

  useEffect(() => {
    fetch(withBasePath('/api/tournament/state'))
      .then((response) => readJsonResponse<{ closed?: boolean; stage?: unknown }>(response))
      .then((result) => {
        if (!result.ok) return
        setAccess({
          loaded: true,
          closed: Boolean(result.data.closed),
          stageOpen: Boolean(result.data.stage),
        })
      })
      .catch(() => setAccess((prev) => ({ ...prev, loaded: true })))
  }, [])

  return access
}
