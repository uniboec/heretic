import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BoutNotNextInScheduleError,
  ScheduleMutationPendingError,
  ScheduleVersionConflictError,
} from '../errors'

const transactionMock = vi.fn()
const acquireMutationOwnershipMock = vi.fn()
const resolveScheduleMutationReplayMock = vi.fn()
const completeScheduleMutationSuccessMock = vi.fn()
const completeScheduleMutationFailedMock = vi.fn()
const withScheduleVersionLockMock = vi.fn()
const readScheduleVersionMock = vi.fn()

vi.mock('../../prisma', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}))

vi.mock('../scheduleMutation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../scheduleMutation')>()
  return {
    ...actual,
    acquireMutationOwnership: acquireMutationOwnershipMock,
    resolveScheduleMutationReplay: resolveScheduleMutationReplayMock,
    completeScheduleMutationSuccess: completeScheduleMutationSuccessMock,
    completeScheduleMutationFailed: completeScheduleMutationFailedMock,
  }
})

vi.mock('../scheduleVersion', () => ({
  readScheduleVersion: readScheduleVersionMock,
  withScheduleVersionLock: withScheduleVersionLockMock,
}))

describe('executeScheduleMutation', () => {
  beforeEach(() => {
    transactionMock.mockReset()
    acquireMutationOwnershipMock.mockReset()
    resolveScheduleMutationReplayMock.mockReset()
    completeScheduleMutationSuccessMock.mockReset()
    completeScheduleMutationFailedMock.mockReset()
    withScheduleVersionLockMock.mockReset()
    readScheduleVersionMock.mockReset()

    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}))
    acquireMutationOwnershipMock.mockResolvedValue({
      record: {
        mutationId: '11111111-1111-4111-8111-111111111111',
        status: 'PENDING',
        requestFingerprint: 'fp',
        boutId: 'cat::bout-1',
        command: 'NO_SHOW',
        actorId: null,
        ownerToken: 'owner',
        leaseUntil: new Date(Date.now() + 60_000),
        committedScheduleVersion: null,
        responseJson: null,
        errorJson: null,
      },
      isOwner: true,
    })
    resolveScheduleMutationReplayMock.mockResolvedValue({ kind: 'execute' })
    readScheduleVersionMock.mockResolvedValue(3)
  })

  it('records FAILED replay for deterministic business errors without version bump', async () => {
    withScheduleVersionLockMock.mockRejectedValue(new BoutNotNextInScheduleError())
    completeScheduleMutationFailedMock.mockResolvedValue(undefined)

    const { executeScheduleMutation } = await import('../executeScheduleMutation')

    await expect(
      executeScheduleMutation({
        mutationId: '11111111-1111-4111-8111-111111111111',
        boutId: 'cat::bout-2',
        command: 'NO_SHOW',
        payload: {},
        actorId: null,
        expectedScheduleVersion: 3,
        execute: async () => ({ result: null, changed: true }),
      }),
    ).rejects.toMatchObject({
      success: false,
      code: 'BOUT_NOT_NEXT_IN_SCHEDULE',
      scheduleVersion: 3,
      replayed: true,
    })

    expect(completeScheduleMutationFailedMock).toHaveBeenCalledOnce()
    expect(completeScheduleMutationSuccessMock).not.toHaveBeenCalled()
  })

  it('throws SCHEDULE_VERSION_CONFLICT for stale expected version on new mutation', async () => {
    withScheduleVersionLockMock.mockRejectedValue(new ScheduleVersionConflictError())
    completeScheduleMutationFailedMock.mockResolvedValue(undefined)

    const { executeScheduleMutation } = await import('../executeScheduleMutation')

    await expect(
      executeScheduleMutation({
        mutationId: '22222222-2222-4222-8222-222222222222',
        boutId: 'cat::bout-1',
        command: 'START',
        payload: {},
        actorId: null,
        expectedScheduleVersion: 1,
        execute: async () => ({ result: null, changed: true }),
      }),
    ).rejects.toMatchObject({
      success: false,
      code: 'SCHEDULE_VERSION_CONFLICT',
      scheduleVersion: 3,
    })
  })

  it('retries when mutation is still pending under another lease', async () => {
    transactionMock
      .mockImplementationOnce(async () => {
        throw new ScheduleMutationPendingError()
      })
      .mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}))

    withScheduleVersionLockMock.mockImplementation(async (_tx, _version, fn) => {
      const outcome = await fn()
      return {
        result: outcome.result,
        committedScheduleVersion: 4,
        scheduleVersion: 4,
      }
    })

    const execute = vi.fn().mockResolvedValue({ result: { ok: true }, changed: true })
    const { executeScheduleMutation } = await import('../executeScheduleMutation')

    const response = await executeScheduleMutation({
      mutationId: '11111111-1111-4111-8111-111111111111',
      boutId: 'cat::bout-1',
      command: 'START',
      payload: {},
      actorId: null,
      expectedScheduleVersion: 3,
      execute,
    })

    expect(response.replayed).toBe(false)
    expect(execute).toHaveBeenCalledOnce()
    expect(transactionMock).toHaveBeenCalledTimes(2)
  })

  it('replays SUCCESS with stale expectedScheduleVersion without version conflict', async () => {
    resolveScheduleMutationReplayMock.mockResolvedValue({
      kind: 'replay_success',
      response: {
        success: true,
        mutationId: '11111111-1111-4111-8111-111111111111',
        committedScheduleVersion: 48,
        scheduleVersion: 49,
        replayed: true,
        result: { scheduleDisplayNumber: '1-1' },
      },
    })

    const execute = vi.fn()
    const { executeScheduleMutation } = await import('../executeScheduleMutation')

    const response = await executeScheduleMutation({
      mutationId: '11111111-1111-4111-8111-111111111111',
      boutId: 'cat::bout-1',
      command: 'START',
      payload: {},
      actorId: null,
      expectedScheduleVersion: 1,
      execute,
    })

    expect(response).toMatchObject({
      replayed: true,
      committedScheduleVersion: 48,
      scheduleVersion: 49,
    })
    expect(execute).not.toHaveBeenCalled()
    expect(withScheduleVersionLockMock).not.toHaveBeenCalled()
  })

  it('replays SUCCESS without executing business logic again', async () => {
    resolveScheduleMutationReplayMock.mockResolvedValue({
      kind: 'replay_success',
      response: {
        success: true,
        mutationId: '11111111-1111-4111-8111-111111111111',
        committedScheduleVersion: 4,
        scheduleVersion: 5,
        replayed: true,
        result: { scheduleDisplayNumber: '1-1' },
      },
    })

    const execute = vi.fn()
    const { executeScheduleMutation } = await import('../executeScheduleMutation')

    const response = await executeScheduleMutation({
      mutationId: '11111111-1111-4111-8111-111111111111',
      boutId: 'cat::bout-1',
      command: 'START',
      payload: {},
      actorId: null,
      expectedScheduleVersion: 99,
      execute,
    })

    expect(response).toMatchObject({
      replayed: true,
      committedScheduleVersion: 4,
      scheduleVersion: 5,
    })
    expect(execute).not.toHaveBeenCalled()
    expect(withScheduleVersionLockMock).not.toHaveBeenCalled()
  })
})
