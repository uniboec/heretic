'use client'

import { useCallback, useEffect } from 'react'
import { drainPendingWalCommands } from '@/lib/bouts/matControlReliability/drainWal'

export function useMatControlWalDrain({
  holderToken,
  enabled,
  onDrained,
}: {
  holderToken: string | null
  enabled: boolean
  onDrained?: () => Promise<void>
}) {
  const drain = useCallback(async () => {
    if (!holderToken || !enabled) return
    const drained = await drainPendingWalCommands({ holderToken })
    if (drained > 0) {
      await onDrained?.()
    }
  }, [enabled, holderToken, onDrained])

  useEffect(() => {
    if (!enabled) return
    void drain()
    const onOnline = () => void drain()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [drain, enabled])
}
