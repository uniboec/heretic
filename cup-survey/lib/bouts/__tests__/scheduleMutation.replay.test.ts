import { describe, expect, it, vi } from 'vitest'
import {
  acquireMutationOwnership,
  buildReplayErrorResponse,
  buildReplaySuccessResponse,
  resolveScheduleMutationReplay,
  SCHEDULE_MUTATION_LEASE_MS,
} from '../scheduleMutation'
import { MutationIdPayloadMismatchError } from '../errors'

describe('scheduleMutation replay and ownership', () => {
  it('replays SUCCESS without re-executing', async () => {
    const record = {
      mutationId: '11111111-1111-4111-8111-111111111111',
      status: 'SUCCESS' as const,
      requestFingerprint: 'fp',
      boutId: 'cat::bout-1',
      command: 'START',
      actorId: null,
      ownerToken: null,
      leaseUntil: null,
      committedScheduleVersion: 3,
      responseJson: { scheduleDisplayNumber: '1-1' },
      errorJson: null,
    }

    const tx = {
      boutsPageSetting: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ scheduleVersion: 5 }),
      },
    }

    const replay = await resolveScheduleMutationReplay(tx as never, record)
    expect(replay.kind).toBe('replay_success')
    if (replay.kind === 'replay_success') {
      expect(replay.response.replayed).toBe(true)
      expect(replay.response.scheduleVersion).toBe(5)
      expect(replay.response.committedScheduleVersion).toBe(3)
      expect(replay.response.result).toEqual({ scheduleDisplayNumber: '1-1' })
    }
  })

  it('replays FAILED with current schedule version', () => {
    const record = {
      mutationId: '11111111-1111-4111-8111-111111111111',
      status: 'FAILED' as const,
      requestFingerprint: 'fp',
      boutId: 'cat::bout-1',
      command: 'START',
      actorId: null,
      ownerToken: null,
      leaseUntil: null,
      committedScheduleVersion: 2,
      responseJson: null,
      errorJson: { code: 'BOUT_NOT_NEXT_IN_SCHEDULE', message: 'Not next' },
    }

    const error = buildReplayErrorResponse(record, 4)
    expect(error.success).toBe(false)
    expect(error.replayed).toBe(true)
    expect(error.scheduleVersion).toBe(4)
    expect(error.code).toBe('BOUT_NOT_NEXT_IN_SCHEDULE')
  })

  it('rejects concurrent mutationId with different payload', async () => {
    const now = new Date()
    const tx = {
      scheduleMutationLog: {
        findUnique: vi.fn().mockResolvedValue({
          mutationId: '11111111-1111-4111-8111-111111111111',
          status: 'SUCCESS',
          requestFingerprint: 'other-fingerprint',
          boutId: 'cat::bout-1',
          command: 'START',
          actorId: null,
          ownerToken: null,
          leaseUntil: null,
          committedScheduleVersion: 1,
          responseJson: {},
          errorJson: null,
        }),
      },
    }

    await expect(
      acquireMutationOwnership({
        tx: tx as never,
        mutationId: '11111111-1111-4111-8111-111111111111',
        requestFingerprint: 'fp',
        boutId: 'cat::bout-1',
        command: 'START',
        actorId: null,
        now,
      }),
    ).rejects.toBeInstanceOf(MutationIdPayloadMismatchError)
  })

  it('takes over expired lease for pending mutation', async () => {
    const now = new Date()
    const expiredLease = new Date(now.getTime() - 1_000)
    const update = vi.fn().mockResolvedValue({
      mutationId: '11111111-1111-4111-8111-111111111111',
      status: 'PENDING',
      requestFingerprint: 'fp',
      boutId: 'cat::bout-1',
      command: 'START',
      actorId: 'actor-1',
      ownerToken: 'new-owner',
      leaseUntil: new Date(now.getTime() + SCHEDULE_MUTATION_LEASE_MS),
      committedScheduleVersion: null,
      responseJson: null,
      errorJson: null,
    })
    const tx = {
      scheduleMutationLog: {
        findUnique: vi.fn().mockResolvedValue({
          mutationId: '11111111-1111-4111-8111-111111111111',
          status: 'PENDING',
          requestFingerprint: 'fp',
          boutId: 'cat::bout-1',
          command: 'START',
          actorId: null,
          ownerToken: 'old-owner',
          leaseUntil: expiredLease,
          committedScheduleVersion: null,
          responseJson: null,
          errorJson: null,
        }),
        update,
      },
    }

    const owned = await acquireMutationOwnership({
      tx: tx as never,
      mutationId: '11111111-1111-4111-8111-111111111111',
      requestFingerprint: 'fp',
      boutId: 'cat::bout-1',
      command: 'START',
      actorId: 'actor-1',
      now,
    })

    expect(owned.isOwner).toBe(true)
    expect(update).toHaveBeenCalledOnce()
  })

  it('builds replay success with committed version fallback', () => {
    const response = buildReplaySuccessResponse(
      {
        mutationId: '11111111-1111-4111-8111-111111111111',
        status: 'SUCCESS',
        requestFingerprint: 'fp',
        boutId: 'cat::bout-1',
        command: 'START',
        actorId: null,
        ownerToken: null,
        leaseUntil: null,
        committedScheduleVersion: null,
        responseJson: { ok: true },
        errorJson: null,
      },
      7,
    )

    expect(response.committedScheduleVersion).toBe(7)
    expect(response.scheduleVersion).toBe(7)
  })
})
