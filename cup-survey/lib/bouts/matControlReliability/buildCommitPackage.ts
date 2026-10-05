import type { MatControlBoutSnapshot } from '../matControlSnapshot'
import type { BoutEventRecord } from '../mat-control/types'
import { computeEventHash, computePackageHash } from './hash'
import { buildCanonicalEventFromCreated } from './commandPayload'
import { resolveEventTypeForIntent } from './clientEventHash'
import { MAT_CONTROL_SCHEMA_VERSION } from './types'
import type { WalCommandRecord } from './wal'

function toPackageEvent(event: BoutEventRecord) {
  const canonical = buildCanonicalEventFromCreated({
    type: event.eventType,
    commandId: event.clientEventId,
    sequenceNo: event.sequence,
    boutElapsedMs: event.boutElapsedMs ?? 0,
    payload: event.payload ?? {},
  })
  const eventHash = event.eventHash ?? computeEventHash(canonical)
  return {
    ...canonical,
    eventHash,
  }
}

export function selectSessionEventsForCommit(
  events: BoutEventRecord[],
  boutSessionId: string,
): BoutEventRecord[] {
  return events
    .filter(
      (event) =>
        !event.undoneAt &&
        event.boutSessionId === boutSessionId &&
        (event.eventStatus === 'STAGED' || event.eventStatus === 'COMMITTED'),
    )
    .sort((a, b) => a.sequence - b.sequence)
}

export function mergeWalSuffixIntoPackageEvents(
  packageEvents: ReturnType<typeof toPackageEvent>[],
  pendingWal: WalCommandRecord[],
  boutSessionId: string,
) {
  const existing = new Set(packageEvents.map((event) => event.commandId))
  const suffix = pendingWal
    .filter(
      (row) =>
        row.boutSessionId === boutSessionId &&
        row.sequenceNo != null &&
        row.eventHash &&
        !existing.has(row.operationId),
    )
    .map((row) => ({
      schemaVersion: MAT_CONTROL_SCHEMA_VERSION,
      type: resolveEventTypeForIntent(row.intent),
      commandId: row.operationId,
      sequenceNo: row.sequenceNo!,
      boutElapsedMs: row.boutElapsedMs ?? 0,
      payload: row.payload,
      eventHash: row.eventHash!,
    }))
  return [...packageEvents, ...suffix].sort((a, b) => a.sequenceNo - b.sequenceNo)
}

export function buildCommitPackageFromBout(input: {
  boutId: string
  boutSessionId: string
  clientSessionId: string
  ownershipEpoch: number
  events: BoutEventRecord[]
  boutView: MatControlBoutSnapshot
  pendingWal?: WalCommandRecord[]
  result: {
    winnerEntryId: string | null
    loserEntryId: string | null
    victoryMethod: string
    decisionReason: string
    decidedInPeriod: string
    officialEndedAt: string
    resultConfirmedAt: string
    confirmedBy?: string
  }
}) {
  const baseEvents = selectSessionEventsForCommit(input.events, input.boutSessionId).map(
    toPackageEvent,
  )
  const packageEvents = input.pendingWal?.length
    ? mergeWalSuffixIntoPackageEvents(baseEvents, input.pendingWal, input.boutSessionId)
    : baseEvents

  const result = input.result
  const finalState = {
    boutPhase: input.boutView.execution.boutPhase,
    liveRevision: input.boutView.execution.liveRevision,
    attemptNumber: input.boutView.execution.attemptNumber,
    clockState: input.boutView.execution.clockState,
    boutElapsedMs: packageEvents.at(-1)?.boutElapsedMs ?? 0,
  }

  const packageBody = {
    schemaVersion: MAT_CONTROL_SCHEMA_VERSION,
    boutId: input.boutId,
    boutSessionId: input.boutSessionId,
    clientSessionId: input.clientSessionId,
    ownershipEpoch: input.ownershipEpoch,
    events: packageEvents,
    result,
    finalState,
  }

  return {
    ...packageBody,
    packageHash: computePackageHash(packageBody),
  }
}
