import { Prisma, type PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import {
  IdempotencyKeyReusedError,
  OperationInProgressError,
} from './errors'

type TransactionClient = Prisma.TransactionClient | PrismaClient

export function computeAwardRequestHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export type ReserveAwardOperationResult =
  | { kind: 'inserted' }
  | { kind: 'replay'; responsePayload: unknown }

function createOperationRowId(): string {
  return `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

export async function reserveAwardOperation(input: {
  tx: TransactionClient
  operationId: string
  requestHash: string
  scopeId?: string
}): Promise<ReserveAwardOperationResult> {
  const scopeId = input.scopeId ?? TOURNAMENT_SCOPE_ID

  const inserted = await input.tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "AwardCeremonyOperation" ("id", "tournamentScopeId", "operationId", "requestHash", "createdAt")
    VALUES (${createOperationRowId()}, ${scopeId}, ${input.operationId}, ${input.requestHash}, CURRENT_TIMESTAMP)
    ON CONFLICT ("tournamentScopeId", "operationId") DO NOTHING
    RETURNING "id"
  `

  if (inserted.length > 0) {
    return { kind: 'inserted' }
  }

  const existing = await input.tx.awardCeremonyOperation.findUnique({
    where: {
      tournamentScopeId_operationId: {
        tournamentScopeId: scopeId,
        operationId: input.operationId,
      },
    },
  })

  if (!existing) {
    throw new OperationInProgressError()
  }

  if (existing.requestHash !== input.requestHash) {
    throw new IdempotencyKeyReusedError()
  }

  if (existing.responsePayload != null) {
    return { kind: 'replay', responsePayload: existing.responsePayload }
  }

  throw new OperationInProgressError()
}

export async function finalizeAwardOperation(input: {
  tx: TransactionClient
  operationId: string
  responsePayload: unknown
  scopeId?: string
}): Promise<void> {
  const scopeId = input.scopeId ?? TOURNAMENT_SCOPE_ID
  await input.tx.awardCeremonyOperation.update({
    where: {
      tournamentScopeId_operationId: {
        tournamentScopeId: scopeId,
        operationId: input.operationId,
      },
    },
    data: {
      responsePayload: input.responsePayload as Prisma.InputJsonValue,
    },
  })
}

export async function withAwardOperation<T>(input: {
  tx: TransactionClient
  operationId: string
  requestPayload: unknown
  scopeId?: string
  run: () => Promise<T>
}): Promise<T> {
  const requestHash = computeAwardRequestHash(input.requestPayload)
  const reserved = await reserveAwardOperation({
    tx: input.tx,
    operationId: input.operationId,
    requestHash,
    scopeId: input.scopeId,
  })

  if (reserved.kind === 'replay') {
    return reserved.responsePayload as T
  }

  const response = await input.run()
  await finalizeAwardOperation({
    tx: input.tx,
    operationId: input.operationId,
    responsePayload: response,
    scopeId: input.scopeId,
  })
  return response
}
