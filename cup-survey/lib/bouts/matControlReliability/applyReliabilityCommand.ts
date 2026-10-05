import type { Prisma } from '@prisma/client'
import {
  BoutAlreadyCommittedError,
  ExpectedSequenceError,
  SessionSupersededError,
  assertFencedOwner,
  mapOwnershipRow,
} from './ownership'
import { buildCommandPayloadHash } from './commandPayload'
import {
  BoutAlreadyCommittedError as BoutAlreadyCommittedApiError,
  ExpectedSequenceError as ExpectedSequenceApiError,
  SessionSupersededError as SessionSupersededApiError,
} from '../mat-control/errors'
import { IdempotencyKeyReusedError } from '../mat-control/errors'

export type ReliabilityCommandInput = {
  boutId: string
  commandId: string
  boutSessionId: string
  clientSessionId: string
  ownershipEpoch: number
  sequenceNo: number
  intent: string
  payload: Record<string, unknown>
  payloadHash: string
  includeBoutElapsedMs?: boolean
}

type TransactionClient = Prisma.TransactionClient

const TERMINAL_STATUSES = new Set(['COMMITTED', 'CANCELLED', 'EXPIRED'])

export async function validateReliabilityFencing(
  tx: TransactionClient,
  input: ReliabilityCommandInput,
): Promise<{ expectedSequenceNo: number; sessionStatus: string }> {
  const ownership = await tx.boutSessionOwnership.findUnique({
    where: { boutSessionId: input.boutSessionId },
  })
  if (!ownership || ownership.boutId !== input.boutId) {
    throw new SessionSupersededApiError('Сессия боя не найдена')
  }

  if (ownership.releasedAt && TERMINAL_STATUSES.has(ownership.sessionStatus)) {
    const duplicate = await tx.boutControlCommand.findUnique({
      where: {
        boutId_operationId: { boutId: input.boutId, operationId: input.commandId },
      },
    })
    if (duplicate) {
      return {
        expectedSequenceNo: ownership.expectedSequenceNo,
        sessionStatus: ownership.sessionStatus,
      }
    }
    throw new BoutAlreadyCommittedApiError()
  }

  assertFencedOwner(mapOwnershipRow(ownership), {
    clientSessionId: input.clientSessionId,
    ownershipEpoch: input.ownershipEpoch,
  })

  const serverHash = buildCommandPayloadHash({
    intent: input.intent,
    sequenceNo: input.sequenceNo,
    payload: input.payload,
    includeBoutElapsedMs: input.includeBoutElapsedMs,
  })
  if (serverHash !== input.payloadHash) {
    throw new IdempotencyKeyReusedError('payloadHash не совпадает с телом команды')
  }

  const duplicate = await tx.boutControlCommand.findUnique({
    where: {
      boutId_operationId: { boutId: input.boutId, operationId: input.commandId },
    },
  })
  if (duplicate) {
    return {
      expectedSequenceNo: ownership.expectedSequenceNo,
      sessionStatus: ownership.sessionStatus,
    }
  }

  if (input.sequenceNo !== ownership.expectedSequenceNo) {
    throw new ExpectedSequenceApiError(
      `Ожидался sequenceNo=${ownership.expectedSequenceNo}, получен ${input.sequenceNo}`,
    )
  }

  return {
    expectedSequenceNo: ownership.expectedSequenceNo,
    sessionStatus: ownership.sessionStatus,
  }
}

export async function bumpReliabilitySequence(
  tx: TransactionClient,
  boutSessionId: string,
  expectedSequenceNo: number,
): Promise<void> {
  const updated = await tx.boutSessionOwnership.updateMany({
    where: { boutSessionId, expectedSequenceNo },
    data: { expectedSequenceNo: expectedSequenceNo + 1 },
  })
  if (updated.count !== 1) {
    throw new ExpectedSequenceApiError('Конфликт sequenceNo при записи события')
  }
}

export function mapReliabilityError(error: unknown): never {
  if (error instanceof SessionSupersededError) {
    throw new SessionSupersededApiError(error.message)
  }
  if (error instanceof BoutAlreadyCommittedError) {
    throw new BoutAlreadyCommittedApiError(error.message)
  }
  if (error instanceof ExpectedSequenceError) {
    throw new ExpectedSequenceApiError(error.message)
  }
  throw error
}
