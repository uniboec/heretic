'use client'

import { useCallback } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { buildCommitPackageFromBout } from '@/lib/bouts/matControlReliability/buildCommitPackage'
import { drainPendingWalCommands } from '@/lib/bouts/matControlReliability/drainWal'
import {
  getClientLifecycleState,
  listPendingWalCommands,
  setClientLifecycleState,
  type BoutSessionClientState,
} from '@/lib/bouts/matControlReliability/wal'
import type { MatControlBoutSnapshot, MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'
import { resolveEffectiveBoutDecision } from '@/lib/bouts/scoreEngine'

export function useMatControlCommit({
  boutView,
  clientState,
  holderToken,
  injuryScoreAcknowledged,
  refresh,
  onSuccess,
  onError,
}: {
  boutView: MatControlBoutSnapshot | null
  clientState: BoutSessionClientState | null
  holderToken: string | null
  injuryScoreAcknowledged?: boolean
  refresh?: () => Promise<MatControlSnapshot | null>
  onSuccess?: () => Promise<void>
  onError?: (message: string) => void
}) {
  const commitBout = useCallback(async () => {
    if (!boutView || !clientState || !holderToken) return false

    await drainPendingWalCommands({ holderToken, boutId: boutView.boutId })
    const fresh = await refresh?.()
    const resolvedBoutView =
      fresh?.activeBout?.boutId === boutView.boutId ? fresh.activeBout : boutView

    const decision = resolveEffectiveBoutDecision({
      events: resolvedBoutView.events,
      period: resolvedBoutView.execution.currentPeriod,
      attemptNumber: resolvedBoutView.execution.attemptNumber,
      participants: resolvedBoutView.participants,
    })

    const latestStoppage = [...resolvedBoutView.events]
      .reverse()
      .find((event) => !event.undoneAt && event.eventType === 'BOUT_STOPPAGE')
    const stoppagePayload = latestStoppage?.payload as { proposedVictoryMethod?: string } | undefined
    const victoryMethod = stoppagePayload?.proposedVictoryMethod ?? 'POINTS'
    const nowIso = new Date().toISOString()

    const pendingWal = await listPendingWalCommands({
      boutId: resolvedBoutView.boutId,
      clientSessionId: clientState.clientSessionId,
    })

    const packageBody = buildCommitPackageFromBout({
      boutId: resolvedBoutView.boutId,
      boutSessionId: clientState.boutSessionId,
      clientSessionId: clientState.clientSessionId,
      ownershipEpoch: clientState.ownershipEpoch,
      events: resolvedBoutView.events,
      boutView: resolvedBoutView,
      pendingWal,
      result: {
        winnerEntryId: decision.winnerEntryId,
        loserEntryId: decision.loserEntryId,
        victoryMethod,
        decisionReason: decision.reason,
        decidedInPeriod: decision.decidedInPeriod,
        officialEndedAt:
          resolvedBoutView.execution.officialEndedAt instanceof Date
            ? resolvedBoutView.execution.officialEndedAt.toISOString()
            : resolvedBoutView.execution.officialEndedAt ?? nowIso,
        resultConfirmedAt: nowIso,
        injuryScoreAcknowledged: Boolean(injuryScoreAcknowledged),
      },
    })

    if (packageBody.events.length === 0) {
      onError?.('Нет STAGED событий сессии для commit — обновите экран')
      return false
    }

    await setClientLifecycleState(resolvedBoutView.boutId, 'FINISHED_LOCALLY')

    try {
      const res = await fetch(
        withBasePath(`/api/admin/bouts/${resolvedBoutView.boutId}/session/commit`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(packageBody),
        },
      )
      const result = await readJsonResponse(res)
      if (!result.ok) {
        await setClientLifecycleState(resolvedBoutView.boutId, 'PENDING_SYNC')
        onError?.(result.error ?? 'Commit не выполнен')
        return false
      }
      await setClientLifecycleState(resolvedBoutView.boutId, 'COMMITTED_LOCAL')
      await onSuccess?.()
      return true
    } catch {
      await setClientLifecycleState(resolvedBoutView.boutId, 'PENDING_SYNC')
      onError?.('Нет связи с сервером — commit в очереди')
      return false
    }
  }, [
    boutView,
    clientState,
    holderToken,
    injuryScoreAcknowledged,
    onError,
    onSuccess,
    refresh,
  ])

  const retryPendingCommit = useCallback(async () => {
    if (!boutView) return false
    const lifecycle = await getClientLifecycleState(boutView.boutId)
    if (lifecycle === 'PENDING_SYNC' || lifecycle === 'FINISHED_LOCALLY') {
      return commitBout()
    }
    return false
  }, [boutView, commitBout])

  return { commitBout, retryPendingCommit }
}
