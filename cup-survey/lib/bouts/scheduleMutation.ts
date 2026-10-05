import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import type { Prisma as PrismaTypes } from '@prisma/client'
import { canonicalJson } from '../brackets/core/hash'
import { createHash } from 'crypto'
import { MutationIdPayloadMismatchError, ScheduleMutationPendingError } from './errors'
import { readScheduleVersion } from './scheduleVersion'

export const SCHEDULE_MUTATION_LEASE_MS = 60_000

export type ScheduleMutationStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export type ScheduleMutationResponse<T = unknown> = {
  success: true
  mutationId?: string
  committedScheduleVersion: number
  scheduleVersion: number
  replayed?: boolean
  result?: T
}

export type ScheduleMutationErrorResponse = {
  success: false
  mutationId?: string
  code: string
  message: string
  committedScheduleVersion?: number
  scheduleVersion: number
  replayed?: boolean
}

export function canonicalizeMutationPayload(payload: unknown): unknown {
  if (payload == null) {
    return {}
  }
  return JSON.parse(canonicalJson(payload))
}

export function computeScheduleMutationFingerprint(input: {
  mutationId: string
  boutId: string
  command: string
  payload: unknown
}): string {
  const canonicalPayload = canonicalizeMutationPayload(input.payload)
  const material = {
    mutationId: input.mutationId,
    boutId: input.boutId,
    command: input.command,
    payload: canonicalPayload,
  }
  return createHash('sha256').update(canonicalJson(material)).digest('hex')
}

function randomOwnerToken(): string {
  return randomBytes(16).toString('hex')
}

export type ScheduleMutationRecord = {
  mutationId: string
  status: ScheduleMutationStatus
  requestFingerprint: string
  boutId: string
  command: string
  actorId: string | null
  ownerToken: string | null
  leaseUntil: Date | null
  committedScheduleVersion: number | null
  responseJson: unknown
  errorJson: unknown
}

function mapRecord(row: {
  mutationId: string
  status: string
  requestFingerprint: string
  boutId: string
  command: string
  actorId: string | null
  ownerToken: string | null
  leaseUntil: Date | null
  committedScheduleVersion: number | null
  responseJson: unknown
  errorJson: unknown
}): ScheduleMutationRecord {
  return {
    mutationId: row.mutationId,
    status: row.status as ScheduleMutationStatus,
    requestFingerprint: row.requestFingerprint,
    boutId: row.boutId,
    command: row.command,
    actorId: row.actorId,
    ownerToken: row.ownerToken,
    leaseUntil: row.leaseUntil,
    committedScheduleVersion: row.committedScheduleVersion,
    responseJson: row.responseJson,
    errorJson: row.errorJson,
  }
}

function isMutationIdReservationRace(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

export async function acquireMutationOwnership(input: {
  tx: PrismaTypes.TransactionClient
  mutationId: string
  requestFingerprint: string
  boutId: string
  command: string
  actorId: string | null
  now: Date
}): Promise<{ record: ScheduleMutationRecord; isOwner: boolean }> {
  const existing = await input.tx.scheduleMutationLog.findUnique({
    where: { mutationId: input.mutationId },
  })

  if (existing) {
    if (existing.requestFingerprint !== input.requestFingerprint) {
      throw new MutationIdPayloadMismatchError()
    }
    const record = mapRecord(existing)
    if (record.status !== 'PENDING') {
      return { record, isOwner: false }
    }

    const leaseValid =
      record.leaseUntil != null && record.leaseUntil.getTime() > input.now.getTime()
    if (leaseValid && record.ownerToken) {
      return { record, isOwner: false }
    }

    const ownerToken = randomOwnerToken()
    const leaseUntil = new Date(input.now.getTime() + SCHEDULE_MUTATION_LEASE_MS)
    const updated = await input.tx.scheduleMutationLog.update({
      where: { mutationId: input.mutationId },
      data: {
        ownerToken,
        leaseUntil,
        actorId: input.actorId,
      },
    })
    return { record: mapRecord(updated), isOwner: true }
  }

  const ownerToken = randomOwnerToken()
  const leaseUntil = new Date(input.now.getTime() + SCHEDULE_MUTATION_LEASE_MS)
  try {
    const created = await input.tx.scheduleMutationLog.create({
      data: {
        mutationId: input.mutationId,
        status: 'PENDING',
        requestFingerprint: input.requestFingerprint,
        boutId: input.boutId,
        command: input.command,
        actorId: input.actorId,
        ownerToken,
        leaseUntil,
      },
    })
    return { record: mapRecord(created), isOwner: true }
  } catch (error) {
    if (isMutationIdReservationRace(error)) {
      throw new ScheduleMutationPendingError()
    }
    throw error
  }
}

export async function completeScheduleMutationSuccess(input: {
  tx: Prisma.TransactionClient
  mutationId: string
  committedScheduleVersion: number
  responseJson: unknown
  now: Date
}): Promise<void> {
  await input.tx.scheduleMutationLog.update({
    where: { mutationId: input.mutationId },
    data: {
      status: 'SUCCESS',
      committedScheduleVersion: input.committedScheduleVersion,
      responseJson: input.responseJson as Prisma.InputJsonValue,
      errorJson: null,
      completedAt: input.now,
      leaseUntil: null,
      ownerToken: null,
    },
  })
}

export async function completeScheduleMutationFailed(input: {
  tx: Prisma.TransactionClient
  mutationId: string
  committedScheduleVersion: number
  errorJson: unknown
  now: Date
}): Promise<void> {
  await input.tx.scheduleMutationLog.update({
    where: { mutationId: input.mutationId },
    data: {
      status: 'FAILED',
      committedScheduleVersion: input.committedScheduleVersion,
      errorJson: input.errorJson as Prisma.InputJsonValue,
      completedAt: input.now,
      leaseUntil: null,
      ownerToken: null,
    },
  })
}

export function buildReplaySuccessResponse<T>(
  record: ScheduleMutationRecord,
  currentScheduleVersion: number,
): ScheduleMutationResponse<T> {
  return {
    success: true,
    mutationId: record.mutationId,
    committedScheduleVersion: record.committedScheduleVersion ?? currentScheduleVersion,
    scheduleVersion: currentScheduleVersion,
    replayed: true,
    result: record.responseJson as T,
  }
}

export function buildReplayErrorResponse(
  record: ScheduleMutationRecord,
  currentScheduleVersion: number,
): ScheduleMutationErrorResponse {
  const error = (record.errorJson ?? {}) as { code?: string; message?: string }
  return {
    success: false,
    mutationId: record.mutationId,
    code: error.code ?? 'SCHEDULE_MUTATION_FAILED',
    message: error.message ?? 'Операция расписания завершилась с ошибкой',
    committedScheduleVersion: record.committedScheduleVersion ?? undefined,
    scheduleVersion: currentScheduleVersion,
    replayed: true,
  }
}

export async function awaitMutationCompletion(
  tx: Prisma.TransactionClient,
  mutationId: string,
  timeoutMs: number,
  pollIntervalMs = 100,
): Promise<ScheduleMutationRecord> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const record = await tx.scheduleMutationLog.findUnique({ where: { mutationId } })
    if (!record) {
      throw new Error(`Schedule mutation ${mutationId} not found`)
    }
    const mapped = mapRecord(record)
    if (mapped.status !== 'PENDING') {
      return mapped
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
  throw new ScheduleMutationPendingError()
}

export async function resolveScheduleMutationReplay<T>(
  tx: Prisma.TransactionClient,
  record: ScheduleMutationRecord,
): Promise<
  | { kind: 'replay_success'; response: ScheduleMutationResponse<T> }
  | { kind: 'replay_error'; response: ScheduleMutationErrorResponse }
  | { kind: 'pending'; record: ScheduleMutationRecord }
  | { kind: 'execute' }
> {
  const currentScheduleVersion = await readScheduleVersion(tx)
  if (record.status === 'SUCCESS') {
    return {
      kind: 'replay_success',
      response: buildReplaySuccessResponse<T>(record, currentScheduleVersion),
    }
  }
  if (record.status === 'FAILED') {
    return {
      kind: 'replay_error',
      response: buildReplayErrorResponse(record, currentScheduleVersion),
    }
  }
  return { kind: 'pending', record }
}
