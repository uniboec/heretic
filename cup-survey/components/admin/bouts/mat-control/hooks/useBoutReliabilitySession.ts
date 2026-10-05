'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import {
  loadBoutSessionClientState,
  loadOrCreateClientSessionId,
  saveBoutSessionClientState,
  type BoutSessionClientState,
} from '@/lib/bouts/matControlReliability/wal'

export type BoutSessionSnapshot = {
  boutSessionId: string
  ownershipEpoch: number
  clientSessionId: string
  sessionStatus: string
  staleAt: string | null
  expectedSequenceNo: number
}

export function useBoutReliabilitySession(boutId: string | null, serverSession: BoutSessionSnapshot | null) {
  const [clientState, setClientState] = useState<BoutSessionClientState | null>(null)
  const acquireInFlight = useRef(false)

  useEffect(() => {
    if (!boutId) {
      setClientState(null)
      return
    }
    void loadBoutSessionClientState(boutId).then(setClientState)
  }, [boutId])

  const syncFromServer = useCallback(async (session: BoutSessionSnapshot) => {
    if (!boutId) return
    const existing = await loadBoutSessionClientState(boutId)
    const clientSessionId = existing?.clientSessionId ?? (await loadOrCreateClientSessionId())
    const next: BoutSessionClientState = {
      boutId,
      boutSessionId: session.boutSessionId,
      ownershipEpoch: session.ownershipEpoch,
      clientSessionId,
      nextSequenceNo: session.expectedSequenceNo,
      acquireRequestId: existing?.acquireRequestId ?? crypto.randomUUID(),
      sessionStatus: session.sessionStatus,
      staleAt: session.staleAt,
    }
    await saveBoutSessionClientState(next)
    setClientState(next)
  }, [boutId])

  useEffect(() => {
    if (!serverSession || !boutId) return
    void syncFromServer(serverSession)
  }, [
    boutId,
    serverSession?.boutSessionId,
    serverSession?.ownershipEpoch,
    serverSession?.expectedSequenceNo,
    serverSession?.sessionStatus,
    serverSession?.staleAt,
    syncFromServer,
  ])

  const acquireSession = useCallback(async () => {
    if (!boutId || acquireInFlight.current) {
      return boutId ? await loadBoutSessionClientState(boutId) : null
    }
    acquireInFlight.current = true
    try {
      const existing = await loadBoutSessionClientState(boutId)
      if (existing?.boutSessionId && existing.boutSessionId === serverSession?.boutSessionId) {
        setClientState(existing)
        return existing
      }

      const clientSessionId = await loadOrCreateClientSessionId()
      const acquireRequestId = existing?.acquireRequestId ?? crypto.randomUUID()
      const res = await fetch(withBasePath(`/api/admin/bouts/${boutId}/session/acquire`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acquireRequestId, clientSessionId }),
      })
      const result = await readJsonResponse<{
        boutSessionId: string
        ownershipEpoch: number
        clientSessionId: string
        sessionStatus: string
      }>(res)
      if (!result.ok || !result.data) return null

      const state: BoutSessionClientState = {
        boutId,
        boutSessionId: result.data.boutSessionId,
        ownershipEpoch: result.data.ownershipEpoch,
        clientSessionId: result.data.clientSessionId,
        nextSequenceNo: serverSession?.expectedSequenceNo ?? 1,
        acquireRequestId,
        sessionStatus: result.data.sessionStatus,
        staleAt: serverSession?.staleAt ?? null,
      }
      await saveBoutSessionClientState(state)
      setClientState(state)
      return state
    } finally {
      acquireInFlight.current = false
    }
  }, [boutId, serverSession?.boutSessionId, serverSession?.expectedSequenceNo, serverSession?.staleAt])

  useEffect(() => {
    if (!boutId) return
    void acquireSession()
  }, [boutId, acquireSession])

  const sendHeartbeat = useCallback(async () => {
    if (!clientState) return
    await fetch(withBasePath(`/api/admin/bouts/${boutId}/session/heartbeat`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boutSessionId: clientState.boutSessionId,
        clientSessionId: clientState.clientSessionId,
        ownershipEpoch: clientState.ownershipEpoch,
      }),
    })
  }, [boutId, clientState])

  useEffect(() => {
    if (!clientState) return
    const timer = window.setInterval(() => {
      void sendHeartbeat()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [clientState, sendHeartbeat])

  return {
    clientState,
    acquireSession,
    isStale: Boolean(clientState?.staleAt ?? serverSession?.staleAt),
  }
}
