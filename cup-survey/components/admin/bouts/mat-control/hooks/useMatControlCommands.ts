'use client'

import { useCallback } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'
import type { ControlIntent, Corner } from '@/lib/bouts/mat-control/types'
import type { PenaltyLadder } from '@/lib/config/fseRules'
import { createOperationId } from '../judge/judgeUtils'
import {
  appendWalCommand,
  loadOrCreateClientSessionId,
  markWalCommandStatus,
  reserveNextSequenceNo,
  type BoutSessionClientState,
} from '@/lib/bouts/matControlReliability/wal'
import { buildCommandPayloadHash } from '@/lib/bouts/matControlReliability/commandPayload'
import { computeClientCommandEventHash } from '@/lib/bouts/matControlReliability/clientEventHash'

type DisqualifyPending = {
  corner: Corner
  ladder: PenaltyLadder
  entryId: string
}

type CommandTarget = {
  boutId: string
  liveRevision: number
  attemptNumber: number
}

type SendCommandOptions = {
  silent?: boolean
}

const TOGGLE_SYNC_ERROR_CODES = new Set([
  'ATHLETE_WAIT_ALREADY_ACTIVE',
  'ATHLETE_WAIT_NOT_ACTIVE',
  'ATHLETE_DOCTOR_ALREADY_ACTIVE',
  'ATHLETE_DOCTOR_NOT_ACTIVE',
  'ATHLETE_EQUIPMENT_ALREADY_ACTIVE',
  'ATHLETE_EQUIPMENT_NOT_ACTIVE',
])

function penaltyLadderFromIntent(intent: ControlIntent): PenaltyLadder {
  if (intent === 'PENALTY_OUT_OF_BOUNDS_NEXT') return 'OUT_OF_BOUNDS'
  if (intent === 'PENALTY_PASSIVITY_NEXT') return 'PASSIVITY'
  return 'GENERAL'
}

function resolveCommandTarget(
  workingBoutId: string | null,
  activeBout: MatControlSnapshot['activeBout'],
  target?: CommandTarget,
  fresh?: MatControlSnapshot | null,
): CommandTarget | null {
  const boutId = target?.boutId ?? workingBoutId
  if (!boutId) return null

  const bout = fresh?.activeBout?.boutId === boutId ? fresh.activeBout : activeBout
  return {
    boutId,
    liveRevision: target?.liveRevision ?? bout?.execution.liveRevision ?? 0,
    attemptNumber: target?.attemptNumber ?? bout?.execution.attemptNumber ?? 1,
  }
}

export function useMatControlCommands({
  holderToken,
  workingBoutId,
  activeBout,
  scheduleVersion,
  refresh,
  setBusy,
  setError,
  setDisqualifyPending,
  onLeaseLost,
  boutElapsedMs,
  clientState,
}: {
  holderToken: string | null
  workingBoutId: string | null
  activeBout: MatControlSnapshot['activeBout']
  scheduleVersion: number
  refresh: () => Promise<MatControlSnapshot | null>
  setBusy: (busy: boolean) => void
  setError: (error: string | null) => void
  setDisqualifyPending: (pending: DisqualifyPending | null) => void
  onLeaseLost?: () => Promise<boolean>
  boutElapsedMs?: number
  clientState?: BoutSessionClientState | null
}) {
  const sendCommand = useCallback(
    async (
      intent: ControlIntent,
      payload: Record<string, unknown> = {},
      target?: CommandTarget,
      options?: SendCommandOptions,
    ) => {
      const payloadWithElapsed =
        boutElapsedMs != null ? { ...payload, boutElapsedMs } : payload
      if (!holderToken) {
        setError('Захватите управление ковром')
        return false
      }

      const initialTarget = resolveCommandTarget(workingBoutId, activeBout, target)
      if (!initialTarget) {
        setError('Нет поединка для команды')
        return false
      }

      const markBusy = !options?.silent
      if (markBusy) {
        setBusy(true)
      }
      setError(null)

      try {
        const operationId = createOperationId()
        const clientSessionId = await loadOrCreateClientSessionId()
        const sequenceNo = clientState ? await reserveNextSequenceNo(initialTarget.boutId) : null
        const payloadHash =
          clientState && sequenceNo
            ? buildCommandPayloadHash({
                intent,
                sequenceNo,
                payload: payloadWithElapsed,
                includeBoutElapsedMs: true,
              })
            : undefined
        const eventHash =
          clientState && sequenceNo
            ? computeClientCommandEventHash({
                intent,
                commandId: operationId,
                sequenceNo,
                payload: payloadWithElapsed,
              })
            : undefined

        await appendWalCommand({
          clientSessionId,
          operationId,
          boutId: initialTarget.boutId,
          boutSessionId: clientState?.boutSessionId,
          ownershipEpoch: clientState?.ownershipEpoch,
          sequenceNo: sequenceNo ?? undefined,
          payloadHash,
          eventHash,
          intent,
          payload: payloadWithElapsed,
          expectedLiveRevision: initialTarget.liveRevision,
          expectedAttemptNumber: initialTarget.attemptNumber,
          boutElapsedMs:
            typeof payloadWithElapsed.boutElapsedMs === 'number'
              ? payloadWithElapsed.boutElapsedMs
              : undefined,
          status: 'pending',
          createdAt: new Date().toISOString(),
        })

        let commandTarget = initialTarget
        let currentScheduleVersion = scheduleVersion
        let staleRetries = 0
        let scheduleRetries = 0
        let leaseRetries = 0

        while (true) {
          const res = await fetch(
            withBasePath(`/api/admin/bouts/${commandTarget.boutId}/control/command`),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operationId,
                holderToken,
                expectedLiveRevision: commandTarget.liveRevision,
                expectedAttemptNumber: commandTarget.attemptNumber,
                intent,
                payload: payloadWithElapsed,
                expectedScheduleVersion: currentScheduleVersion,
                reliability:
                  clientState && sequenceNo && payloadHash
                    ? {
                        boutSessionId: clientState.boutSessionId,
                        clientSessionId: clientState.clientSessionId,
                        ownershipEpoch: clientState.ownershipEpoch,
                        sequenceNo,
                        payloadHash,
                      }
                    : undefined,
              }),
            },
          )
          const result = await readJsonResponse<{ error?: string; code?: string }>(res)

          if (result.ok) {
            await markWalCommandStatus(operationId, 'acked')
            await refresh()
            return true
          }

          const errorCode =
            result.body && typeof result.body === 'object' && 'code' in result.body
              ? String((result.body as { code?: string }).code ?? '')
              : ''

          if (errorCode === 'SESSION_SUPERSEDED') {
            setError('Сессия боя устарела — требуется handoff администратора')
            return false
          }

          if (errorCode === 'LEASE_NOT_HELD' && onLeaseLost && leaseRetries < 1) {
            leaseRetries += 1
            const reacquired = await onLeaseLost()
            if (reacquired) continue
          }

          if (errorCode === 'SCHEDULE_VERSION_CONFLICT' && scheduleRetries < 1) {
            scheduleRetries += 1
            const fresh = await refresh()
            if (typeof fresh?.scheduleVersion === 'number') {
              currentScheduleVersion = fresh.scheduleVersion
            }
            continue
          }

          if (errorCode === 'BOUT_NOT_NEXT_IN_SCHEDULE') {
            await refresh()
            setError(
              result.error ??
                'Можно начать только следующий поединок в очереди на этом ковре',
            )
            return false
          }

          if (
            (errorCode === 'STALE_LIVE_REVISION' || errorCode === 'ATTEMPT_MISMATCH') &&
            staleRetries < 2
          ) {
            staleRetries += 1
            const fresh = await refresh()
            if (typeof fresh?.scheduleVersion === 'number') {
              currentScheduleVersion = fresh.scheduleVersion
            }
            const retriedTarget = resolveCommandTarget(
              workingBoutId,
              activeBout,
              target,
              fresh,
            )
            if (!retriedTarget) return false
            commandTarget = retriedTarget
            continue
          }

          if (
            errorCode === 'STALE_LIVE_REVISION' ||
            errorCode === 'ATTEMPT_MISMATCH' ||
            TOGGLE_SYNC_ERROR_CODES.has(errorCode)
          ) {
            await refresh()
            if (errorCode === 'STALE_LIVE_REVISION' || errorCode === 'ATTEMPT_MISMATCH') {
              setError('Состояние боя изменилось — повторите действие')
            }
            return false
          }

          if (errorCode === 'DISQUALIFICATION_CONFIRMATION_REQUIRED') {
            const corner = payload.corner as Corner | undefined
            const entryId = payload.entryId as string | undefined
            const ladder = penaltyLadderFromIntent(intent)
            await refresh()
            if (corner && entryId) {
              setDisqualifyPending({ corner, ladder, entryId })
            } else {
              setError(result.error ?? 'Требуется подтверждение дисквалификации')
            }
            return false
          }

          await markWalCommandStatus(operationId, 'failed', result.error ?? 'Команда не выполнена')
          setError(result.error ?? 'Команда не выполнена')
          return false
        }
      } finally {
        if (markBusy) {
          setBusy(false)
        }
      }
    },
    [
      activeBout,
      clientState,
      holderToken,
      onLeaseLost,
      refresh,
      scheduleVersion,
      setBusy,
      setDisqualifyPending,
      setError,
      workingBoutId,
      boutElapsedMs,
    ],
  )

  return { sendCommand }
}
