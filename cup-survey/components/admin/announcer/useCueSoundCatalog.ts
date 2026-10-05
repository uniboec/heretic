'use client'

import { useCallback, useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { CUE_SOUNDS, type CueSoundDefinition } from '@/lib/announcer/cueCatalog'
import { readJsonResponse } from '@/lib/http/readJsonResponse'

function mapCueSounds(
  cueSounds: Array<{ id: string; label: string; family?: string; durationMs?: number }>,
): CueSoundDefinition[] {
  return cueSounds.map((sound) => {
    const builtIn = CUE_SOUNDS.find((entry) => entry.id === sound.id)
    if (builtIn) return builtIn
    return {
      id: sound.id,
      label: sound.label,
      family: (sound.family as CueSoundDefinition['family']) ?? 'neutral',
      path: `/api/admin/announcer/cues/${sound.id}/audio`,
      durationMs: sound.durationMs ?? 700,
    }
  })
}

export function useCueSoundCatalog(): {
  catalog: CueSoundDefinition[]
  reloadCatalog: () => Promise<void>
} {
  const [catalog, setCatalog] = useState<CueSoundDefinition[]>(CUE_SOUNDS)

  const reloadCatalog = useCallback(async () => {
    const response = await fetch(withBasePath('/api/admin/announcer/providers'), { cache: 'no-store' })
    const result = await readJsonResponse<{
      cueSounds: Array<{ id: string; label: string; family?: string; durationMs?: number }>
    }>(response)
    if (!result.ok || !result.data?.cueSounds) return
    setCatalog(mapCueSounds(result.data.cueSounds))
  }, [])

  useEffect(() => {
    void reloadCatalog()
  }, [reloadCatalog])

  return { catalog, reloadCatalog }
}
