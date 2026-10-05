export const MAT_CONTROL_SCHEMA_VERSION = 1

export type BoutSessionStatus =
  | 'ACTIVE'
  | 'COMMITTING'
  | 'REJECTED_VALIDATION'
  | 'COMMITTED'
  | 'CANCELLED'
  | 'EXPIRED'

export type BoutEventStatus = 'STAGED' | 'COMMITTED'

export type OwnershipRecord = {
  boutId: string
  boutSessionId: string
  clientSessionId: string
  ownershipEpoch: number
  sessionStatus: BoutSessionStatus
  leasedAt: Date
  releasedAt: Date | null
  heartbeatAt: Date | null
  staleAt: Date | null
  clockStartedAt: Date | null
  leasedByUserId: string | null
}

export type AcquireBoutSessionResult = {
  boutSessionId: string
  ownershipEpoch: number
  clientSessionId: string
  sessionStatus: BoutSessionStatus
}

export type CanonicalCommandBody = {
  schemaVersion: number
  boutSessionId: string
  clientSessionId: string
  ownershipEpoch: number
  commandId: string
  sequenceNo: number
  intent: string
  payload: Record<string, unknown>
}

export type CanonicalEvent = {
  schemaVersion: number
  type: string
  commandId: string
  sequenceNo: number
  boutElapsedMs: number
  payload: Record<string, unknown>
}

export type CommitPackageEvent = CanonicalEvent & {
  eventHash: string
}

export type CommitBoutPackageInput = {
  schemaVersion: number
  boutId: string
  boutSessionId: string
  clientSessionId: string
  ownershipEpoch: number
  events: CommitPackageEvent[]
  result: Record<string, unknown>
  finalState: Record<string, unknown>
  packageHash?: string
}

export type ReconcileCandidateResult =
  | { ok: true; suffix: CommitPackageEvent[] }
  | { ok: false; errors: string[] }
