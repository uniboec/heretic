import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { BoutsSchedulerError, ScheduleMutationPendingError } from './errors'
import {
  acquireMutationOwnership,
  buildReplayErrorResponse,
  completeScheduleMutationFailed,
  completeScheduleMutationSuccess,
  computeScheduleMutationFingerprint,
  resolveScheduleMutationReplay,
  type ScheduleMutationResponse,
} from './scheduleMutation'
import { readScheduleVersion, withScheduleVersionLock } from './scheduleVersion'

export type ExecuteScheduleMutationInput<T> = {
  mutationId: string
  boutId: string
  command: string
  payload: unknown
  actorId: string | null
  expectedScheduleVersion: number
  execute: (
    tx: Prisma.TransactionClient,
  ) => Promise<{ result: T; changed: boolean }>
}

const MUTATION_PENDING_RETRY_MS = 50
const MUTATION_PENDING_MAX_ATTEMPTS = 40

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isScheduleMutationPendingError(error: unknown): boolean {
  return error instanceof ScheduleMutationPendingError
}

function isRetryableScheduleMutationConflict(error: unknown): boolean {
  if (error instanceof ScheduleMutationPendingError) {
    return true
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' ||
      error.message.includes('write conflict') ||
      error.message.includes('deadlock'))
  ) {
    return true
  }
  return (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    (error.message.includes('could not serialize access') ||
      error.message.includes('deadlock') ||
      error.message.includes('current transaction is aborted'))
  )
}

async function executeScheduleMutationOnce<T>(
  input: ExecuteScheduleMutationInput<T>,
): Promise<ScheduleMutationResponse<T>> {
  const requestFingerprint = computeScheduleMutationFingerprint({
    mutationId: input.mutationId,
    boutId: input.boutId,
    command: input.command,
    payload: input.payload,
  })

  const now = new Date()

  return prisma.$transaction(
    async (tx) => {
      const { record, isOwner } = await acquireMutationOwnership({
        tx,
        mutationId: input.mutationId,
        requestFingerprint,
        boutId: input.boutId,
        command: input.command,
        actorId: input.actorId,
        now,
      })

      const replay = await resolveScheduleMutationReplay<T>(tx, record)
      if (replay.kind === 'replay_success') {
        return replay.response
      }
      if (replay.kind === 'replay_error') {
        throw replay.response
      }
      if (!isOwner) {
        const refreshed = await tx.scheduleMutationLog.findUniqueOrThrow({
          where: { mutationId: input.mutationId },
        })
        const waited = await resolveScheduleMutationReplay<T>(tx, {
          mutationId: refreshed.mutationId,
          status: refreshed.status as 'PENDING' | 'SUCCESS' | 'FAILED',
          requestFingerprint: refreshed.requestFingerprint,
          boutId: refreshed.boutId,
          command: refreshed.command,
          actorId: refreshed.actorId,
          ownerToken: refreshed.ownerToken,
          leaseUntil: refreshed.leaseUntil,
          committedScheduleVersion: refreshed.committedScheduleVersion,
          responseJson: refreshed.responseJson,
          errorJson: refreshed.errorJson,
        })
        if (waited.kind === 'replay_success') {
          return waited.response
        }
        if (waited.kind === 'replay_error') {
          throw waited.response
        }
        throw new ScheduleMutationPendingError()
      }

      try {
        const locked = await withScheduleVersionLock(tx, input.expectedScheduleVersion, async () => {
          const outcome = await input.execute(tx)
          return {
            result: outcome.result,
            changed: outcome.changed,
          }
        })

        const response: ScheduleMutationResponse<T> = {
          success: true,
          mutationId: input.mutationId,
          committedScheduleVersion: locked.committedScheduleVersion,
          scheduleVersion: locked.scheduleVersion,
          replayed: false,
          result: locked.result,
        }

        await completeScheduleMutationSuccess({
          tx,
          mutationId: input.mutationId,
          committedScheduleVersion: locked.committedScheduleVersion,
          responseJson: response,
          now,
        })

        return response
      } catch (error) {
        const currentScheduleVersion = await readScheduleVersion(tx)
        if (error instanceof BoutsSchedulerError) {
          const errorResponse = buildReplayErrorResponse(
            {
              mutationId: input.mutationId,
              status: 'FAILED',
              requestFingerprint,
              boutId: input.boutId,
              command: input.command,
              actorId: input.actorId,
              ownerToken: null,
              leaseUntil: null,
              committedScheduleVersion: currentScheduleVersion,
              responseJson: null,
              errorJson: {
                code: error.code,
                message: error.message,
              },
            },
            currentScheduleVersion,
          )
          await completeScheduleMutationFailed({
            tx,
            mutationId: input.mutationId,
            committedScheduleVersion: currentScheduleVersion,
            errorJson: errorResponse,
            now,
          })
          throw errorResponse
        }
        throw error
      }
    },
    {
      maxWait: 15_000,
      timeout: 30_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  )
}

export async function executeScheduleMutation<T>(
  input: ExecuteScheduleMutationInput<T>,
): Promise<ScheduleMutationResponse<T>> {
  for (let attempt = 0; attempt < MUTATION_PENDING_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await executeScheduleMutationOnce(input)
    } catch (error) {
      if (isRetryableScheduleMutationConflict(error) && attempt < MUTATION_PENDING_MAX_ATTEMPTS - 1) {
        await sleep(MUTATION_PENDING_RETRY_MS)
        continue
      }
      throw error
    }
  }

  throw new ScheduleMutationPendingError()
}
