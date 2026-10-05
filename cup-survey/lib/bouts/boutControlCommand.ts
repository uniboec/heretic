import { Prisma, type PrismaClient } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { computeRequestFingerprint } from './computeRequestFingerprint'
import { CommandReservationRaceError, IdempotencyKeyReusedError } from './mat-control/errors'

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

type TransactionClient = Prisma.TransactionClient | PrismaClient

export type ReserveCommandResult =
  | { kind: 'inserted'; commandId: string }
  | { kind: 'replay'; responseJson: unknown }

export async function reserveBoutControlCommand(input: {
  tx: TransactionClient
  boutId: string
  operationId: string
  commandType: string
  payload: unknown
}): Promise<ReserveCommandResult> {
  const requestFingerprint = computeRequestFingerprint(input.commandType, input.payload)

  const existing = await input.tx.boutControlCommand.findUnique({
    where: {
      boutId_operationId: {
        boutId: input.boutId,
        operationId: input.operationId,
      },
    },
  })

  if (existing) {
    if (existing.requestFingerprint !== requestFingerprint) {
      throw new IdempotencyKeyReusedError()
    }
    return { kind: 'replay', responseJson: existing.responseJson }
  }

  try {
    const created = await input.tx.boutControlCommand.create({
      data: {
        boutId: input.boutId,
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        operationId: input.operationId,
        commandType: input.commandType,
        requestFingerprint,
        responseJson: {},
        createdEventIds: [],
      },
    })

    return { kind: 'inserted', commandId: created.id }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new CommandReservationRaceError()
    }
    throw error
  }
}

export async function finalizeBoutControlCommand(input: {
  tx: TransactionClient
  boutId: string
  operationId: string
  responseJson: unknown
  createdEventIds: string[]
}): Promise<void> {
  await input.tx.boutControlCommand.update({
    where: {
      boutId_operationId: {
        boutId: input.boutId,
        operationId: input.operationId,
      },
    },
    data: {
      responseJson: input.responseJson as Prisma.InputJsonValue,
      createdEventIds: input.createdEventIds,
    },
  })
}
