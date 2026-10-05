import { randomUUID } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { AcquireBoutSessionResult, BoutSessionStatus, OwnershipRecord } from './types'

type TransactionClient = Prisma.TransactionClient | PrismaClient

export class BoutAlreadyCommittedError extends Error {
  readonly code = 'BOUT_ALREADY_COMMITTED'
  constructor(message = 'Bout already committed') {
    super(message)
    this.name = 'BoutAlreadyCommittedError'
  }
}

export class BoutSessionAlreadyActiveError extends Error {
  readonly code = 'BOUT_SESSION_ALREADY_ACTIVE'
  constructor(message = 'Active bout session already exists') {
    super(message)
    this.name = 'BoutSessionAlreadyActiveError'
  }
}

export class SessionSupersededError extends Error {
  readonly code = 'SESSION_SUPERSEDED'
  constructor(message = 'Ownership epoch superseded') {
    super(message)
    this.name = 'SessionSupersededError'
  }
}

export class ExpectedSequenceError extends Error {
  readonly code = 'EXPECTED_SEQUENCE'
  readonly expectedSequenceNo: number
  constructor(expectedSequenceNo: number) {
    super(`Expected sequence ${expectedSequenceNo}`)
    this.name = 'ExpectedSequenceError'
    this.expectedSequenceNo = expectedSequenceNo
  }
}

export function mapOwnershipRow(row: {
  boutId: string
  boutSessionId: string
  clientSessionId: string
  ownershipEpoch: number
  sessionStatus: string
  leasedAt: Date
  releasedAt: Date | null
  heartbeatAt: Date | null
  staleAt: Date | null
  clockStartedAt: Date | null
  leasedByUserId: string | null
}): OwnershipRecord {
  return {
    boutId: row.boutId,
    boutSessionId: row.boutSessionId,
    clientSessionId: row.clientSessionId,
    ownershipEpoch: row.ownershipEpoch,
    sessionStatus: row.sessionStatus as BoutSessionStatus,
    leasedAt: row.leasedAt,
    releasedAt: row.releasedAt,
    heartbeatAt: row.heartbeatAt,
    staleAt: row.staleAt,
    clockStartedAt: row.clockStartedAt,
    leasedByUserId: row.leasedByUserId,
  }
}

export function assertFencedOwner(
  ownership: OwnershipRecord,
  input: { clientSessionId: string; ownershipEpoch: number },
): void {
  if (
    ownership.ownershipEpoch !== input.ownershipEpoch ||
    ownership.clientSessionId !== input.clientSessionId
  ) {
    throw new SessionSupersededError()
  }
}

export async function acquireBoutSession(
  tx: TransactionClient,
  input: {
    boutId: string
    acquireRequestId: string
    leasedByUserId?: string
    clientSessionId?: string
  },
): Promise<AcquireBoutSessionResult> {
  const committed = await tx.boutResult.findFirst({
    where: { boutId: input.boutId, invalidatedAt: null },
    select: { id: true },
  })
  if (committed) {
    throw new BoutAlreadyCommittedError()
  }

  const cached = await tx.boutSessionAcquireRequest.findUnique({
    where: {
      boutId_acquireRequestId: {
        boutId: input.boutId,
        acquireRequestId: input.acquireRequestId,
      },
    },
  })
  if (cached) {
    const ownership = await tx.boutSessionOwnership.findUnique({
      where: { boutSessionId: cached.boutSessionId },
    })
    if (!ownership) {
      throw new Error('Acquire cache points to missing ownership')
    }
    return {
      boutSessionId: ownership.boutSessionId,
      ownershipEpoch: ownership.ownershipEpoch,
      clientSessionId: ownership.clientSessionId,
      sessionStatus: ownership.sessionStatus as BoutSessionStatus,
    }
  }

  const active = await tx.boutSessionOwnership.findFirst({
    where: { boutId: input.boutId, releasedAt: null },
  })
  if (active) {
    throw new BoutSessionAlreadyActiveError()
  }

  const boutSessionId = randomUUID()
  const clientSessionId = input.clientSessionId ?? randomUUID()
  const now = new Date()

  await tx.boutSessionOwnership.create({
    data: {
      boutId: input.boutId,
      boutSessionId,
      clientSessionId,
      ownershipEpoch: 1,
      sessionStatus: 'ACTIVE',
      leasedAt: now,
      heartbeatAt: now,
      leasedByUserId: input.leasedByUserId ?? null,
    },
  })

  await tx.boutSessionAcquireRequest.create({
    data: {
      boutId: input.boutId,
      acquireRequestId: input.acquireRequestId,
      boutSessionId,
    },
  })

  return {
    boutSessionId,
    ownershipEpoch: 1,
    clientSessionId,
    sessionStatus: 'ACTIVE',
  }
}

export async function handoffBoutSession(
  tx: TransactionClient,
  input: {
    boutId: string
    boutSessionId: string
    newClientSessionId: string
    adminId: string
    reason: string
    suffixDisposition: 'SYNCED' | 'DISCARDED' | 'UNKNOWN_FORCE_TAKEOVER'
  },
): Promise<{ ownershipEpoch: number; clientSessionId: string }> {
  const ownership = await tx.boutSessionOwnership.findFirst({
    where: { boutId: input.boutId, boutSessionId: input.boutSessionId, releasedAt: null },
  })
  if (!ownership) {
    throw new Error('No active ownership for handoff')
  }
  if (ownership.sessionStatus === 'COMMITTING') {
    throw new Error('Takeover forbidden while COMMITTING')
  }
  if (!['ACTIVE', 'REJECTED_VALIDATION'].includes(ownership.sessionStatus)) {
    throw new Error(`Takeover forbidden in status ${ownership.sessionStatus}`)
  }

  const newEpoch = ownership.ownershipEpoch + 1
  const now = new Date()

  await tx.boutSessionOwnership.update({
    where: { boutSessionId: ownership.boutSessionId },
    data: {
      clientSessionId: input.newClientSessionId,
      ownershipEpoch: newEpoch,
      heartbeatAt: now,
      staleAt: null,
    },
  })

  await tx.boutOwnershipTakeoverLog.create({
    data: {
      boutSessionId: ownership.boutSessionId,
      oldClientSessionId: ownership.clientSessionId,
      newClientSessionId: input.newClientSessionId,
      oldEpoch: ownership.ownershipEpoch,
      newEpoch,
      adminId: input.adminId,
      reason: input.reason,
      suffixDisposition: input.suffixDisposition,
    },
  })

  return {
    ownershipEpoch: newEpoch,
    clientSessionId: input.newClientSessionId,
    expectedSequenceNo: ownership.expectedSequenceNo,
  }
}

export async function touchBoutSessionHeartbeat(
  tx: TransactionClient,
  input: { boutSessionId: string; ownershipEpoch: number; clientSessionId: string },
): Promise<void> {
  const ownership = await tx.boutSessionOwnership.findUnique({
    where: { boutSessionId: input.boutSessionId },
  })
  if (!ownership || ownership.releasedAt) return
  assertFencedOwner(mapOwnershipRow(ownership), input)
  const now = new Date()
  await tx.boutSessionOwnership.update({
    where: { boutSessionId: input.boutSessionId },
    data: { heartbeatAt: now, staleAt: null },
  })
}

export async function markBoutSessionStale(
  tx: TransactionClient,
  boutSessionId: string,
): Promise<void> {
  await tx.boutSessionOwnership.updateMany({
    where: { boutSessionId, releasedAt: null },
    data: { staleAt: new Date() },
  })
}

export const BOUT_SESSION_HEARTBEAT_STALE_MS = 90_000

export async function markStaleSessionsFromHeartbeatTimeout(
  tx: TransactionClient,
  now = new Date(),
): Promise<number> {
  const threshold = new Date(now.getTime() - BOUT_SESSION_HEARTBEAT_STALE_MS)
  const result = await tx.boutSessionOwnership.updateMany({
    where: {
      releasedAt: null,
      sessionStatus: { in: ['ACTIVE', 'REJECTED_VALIDATION'] },
      staleAt: null,
      heartbeatAt: { lt: threshold },
    },
    data: { staleAt: now },
  })
  return result.count
}

export class BoutSessionReclaimForbiddenError extends Error {
  readonly code = 'BOUT_SESSION_RECLAIM_FORBIDDEN'
  constructor(message = 'Session cannot be reclaimed in current status') {
    super(message)
    this.name = 'BoutSessionReclaimForbiddenError'
  }
}

export async function reclaimBoutSession(
  tx: TransactionClient,
  input: {
    boutId: string
    boutSessionId: string
    status: 'EXPIRED' | 'CANCELLED'
    reason: string
  },
): Promise<void> {
  const ownership = await tx.boutSessionOwnership.findFirst({
    where: {
      boutId: input.boutId,
      boutSessionId: input.boutSessionId,
      releasedAt: null,
    },
  })
  if (!ownership) {
    throw new Error('No active ownership for reclaim')
  }
  if (ownership.sessionStatus === 'COMMITTING') {
    throw new BoutSessionReclaimForbiddenError('Reclaim forbidden while COMMITTING')
  }
  if (!['ACTIVE', 'REJECTED_VALIDATION'].includes(ownership.sessionStatus)) {
    throw new BoutSessionReclaimForbiddenError(
      `Reclaim forbidden in status ${ownership.sessionStatus}`,
    )
  }

  const now = new Date()
  await tx.boutSessionOwnership.update({
    where: { boutSessionId: input.boutSessionId },
    data: {
      sessionStatus: input.status,
      releasedAt: now,
      staleAt: ownership.staleAt ?? now,
    },
  })
}
