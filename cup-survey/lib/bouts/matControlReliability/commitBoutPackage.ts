import type { Prisma, PrismaClient } from '@prisma/client'
import { computePackageHash } from './hash'
import { assertFencedOwner, mapOwnershipRow } from './ownership'
import { reconcileCandidate } from './reconcileCandidate'
import type { CommitBoutPackageInput } from './types'

type TransactionClient = Prisma.TransactionClient | PrismaClient

export class AlreadyCommittedDifferentPayloadError extends Error {
  readonly code = 'ALREADY_COMMITTED_DIFFERENT_PAYLOAD'
  constructor(message = 'Bout committed with different package hash') {
    super(message)
    this.name = 'AlreadyCommittedDifferentPayloadError'
  }
}

export type CommitBoutPackageAck = {
  ok: true
  packageHash: string
  sessionStatus: 'COMMITTED'
  cached: boolean
}

export async function commitBoutPackage(
  tx: TransactionClient,
  input: CommitBoutPackageInput,
): Promise<CommitBoutPackageAck> {
  const serverPackageHash = computePackageHash(input)

  const ownership = await tx.boutSessionOwnership.findUnique({
    where: { boutSessionId: input.boutSessionId },
  })
  if (!ownership) {
    throw new Error('Unknown bout session')
  }

  if (ownership.sessionStatus === 'COMMITTED' && ownership.releasedAt) {
    const prior = await tx.boutSessionCommitAck.findUnique({
      where: { boutSessionId: input.boutSessionId },
    })
    if (prior?.packageHash === serverPackageHash) {
      return { ok: true, packageHash: serverPackageHash, sessionStatus: 'COMMITTED', cached: true }
    }
    throw new AlreadyCommittedDifferentPayloadError()
  }

  assertFencedOwner(mapOwnershipRow(ownership), {
    clientSessionId: input.clientSessionId,
    ownershipEpoch: input.ownershipEpoch,
  })

  const stagedRows = await tx.boutEvent.findMany({
    where: {
      boutId: input.boutId,
      eventStatus: 'STAGED',
      boutSessionId: input.boutSessionId,
    },
    orderBy: { sequence: 'asc' },
  })

  const staged = stagedRows.map((row) => ({
    sequenceNo: row.sequence,
    commandId: row.clientEventId,
    eventHash: row.eventHash ?? '',
    type: row.eventType,
    boutElapsedMs: row.boutElapsedMs ?? 0,
    payload: (row.payload ?? {}) as Record<string, unknown>,
  }))

  const reconcile = reconcileCandidate(staged, input)
  if (!reconcile.ok) {
    await tx.boutSessionOwnership.update({
      where: { boutSessionId: input.boutSessionId },
      data: { sessionStatus: 'REJECTED_VALIDATION' },
    })
    throw new Error(reconcile.errors.join('; '))
  }

  await tx.boutSessionOwnership.update({
    where: { boutSessionId: input.boutSessionId },
    data: { sessionStatus: 'COMMITTING' },
  })

  for (const event of reconcile.suffix) {
    await tx.boutEvent.create({
      data: {
        boutId: input.boutId,
        clientEventId: event.commandId,
        sequence: event.sequenceNo,
        eventType: event.type,
        boutElapsedMs: event.boutElapsedMs,
        payload: event.payload as Prisma.InputJsonValue,
        eventStatus: 'STAGED',
        eventHash: event.eventHash,
        boutSessionId: input.boutSessionId,
        period: 'main',
        attemptNumber: 1,
      },
    })
  }

  await tx.boutEvent.updateMany({
    where: { boutId: input.boutId, boutSessionId: input.boutSessionId, eventStatus: 'STAGED' },
    data: { eventStatus: 'COMMITTED' },
  })

  const now = new Date()
  await tx.boutSessionOwnership.update({
    where: { boutSessionId: input.boutSessionId },
    data: {
      sessionStatus: 'COMMITTED',
      releasedAt: now,
    },
  })

  await tx.boutSessionCommitAck.upsert({
    where: { boutSessionId: input.boutSessionId },
    create: {
      boutSessionId: input.boutSessionId,
      packageHash: serverPackageHash,
      committedAt: now,
    },
    update: {
      packageHash: serverPackageHash,
      committedAt: now,
    },
  })

  return { ok: true, packageHash: serverPackageHash, sessionStatus: 'COMMITTED', cached: false }
}
