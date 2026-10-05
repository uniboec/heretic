'use client'

import { useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { ProviderInfo } from '@/lib/announcer/voiceDisplay'

export function useAnnouncerProviders(): ProviderInfo[] {
  const [providers, setProviders] = useState<ProviderInfo[]>([])

  useEffect(() => {
    void fetch(withBasePath('/api/admin/announcer/providers'), { cache: 'no-store' })
      .then((response) => readJsonResponse<{ providers: ProviderInfo[] }>(response))
      .then((result) => {
        if (result.ok && result.data) setProviders(result.data.providers)
      })
  }, [])

  return providers
}
