import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { ControlIntent } from '../mat-control/types'
import { listPendingWalCommands, markWalCommandStatus } from './wal'

export async function drainPendingWalCommands(input: {
  holderToken: string
  boutId?: string
}): Promise<number> {
  const pending = await listPendingWalCommands({ boutId: input.boutId })
  let drained = 0
  for (const row of pending) {
    const res = await fetch(withBasePath(`/api/admin/bouts/${row.boutId}/control/command`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId: row.operationId,
        holderToken: input.holderToken,
        expectedLiveRevision: row.expectedLiveRevision,
        expectedAttemptNumber: row.expectedAttemptNumber,
        intent: row.intent as ControlIntent,
        payload: row.payload,
        reliability:
          row.boutSessionId && row.ownershipEpoch && row.sequenceNo && row.payloadHash
            ? {
                boutSessionId: row.boutSessionId,
                clientSessionId: row.clientSessionId,
                ownershipEpoch: row.ownershipEpoch,
                sequenceNo: row.sequenceNo,
                payloadHash: row.payloadHash,
              }
            : undefined,
      }),
    })
    const result = await readJsonResponse(res)
    if (result.ok) {
      await markWalCommandStatus(row.operationId, 'acked')
      drained += 1
    }
  }
  return drained
}
