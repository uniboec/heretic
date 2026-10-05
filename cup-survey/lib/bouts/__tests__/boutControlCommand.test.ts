import { describe, expect, it, vi } from 'vitest'
import {
  finalizeBoutControlCommand,
  reserveBoutControlCommand,
} from '../boutControlCommand'
import { computeRequestFingerprint } from '../computeRequestFingerprint'
import { CommandReservationRaceError, IdempotencyKeyReusedError } from '../mat-control/errors'

describe('boutControlCommand', () => {
  it('replays committed operationId with matching fingerprint', async () => {
    const fingerprint = computeRequestFingerprint('CLOCK_START', {})
    const tx = {
      boutControlCommand: {
        findUnique: vi.fn().mockResolvedValue({
          requestFingerprint: fingerprint,
          responseJson: { ok: true, liveRevision: 3 },
        }),
        create: vi.fn(),
        update: vi.fn(),
      },
    }

    const result = await reserveBoutControlCommand({
      tx: tx as never,
      boutId: 'bout-1',
      operationId: 'op-1',
      commandType: 'CLOCK_START',
      payload: {},
    })

    expect(result).toEqual({ kind: 'replay', responseJson: { ok: true, liveRevision: 3 } })
    expect(tx.boutControlCommand.create).not.toHaveBeenCalled()
  })

  it('throws IDEMPOTENCY_KEY_REUSED when operationId reused with different payload', async () => {
    const tx = {
      boutControlCommand: {
        findUnique: vi.fn().mockResolvedValue({
          requestFingerprint: 'fp-old',
        }),
      },
    }

    await expect(
      reserveBoutControlCommand({
        tx: tx as never,
        boutId: 'bout-1',
        operationId: 'op-1',
        commandType: 'TECHNICAL_SCORE',
        payload: { points: 2 },
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyReusedError)
  })

  it('signals reservation race when parallel insert hits unique constraint', async () => {
    const { Prisma } = await import('@prisma/client')
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: 'test',
    })
    const tx = {
      boutControlCommand: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(error),
        update: vi.fn(),
      },
    }

    await expect(
      reserveBoutControlCommand({
        tx: tx as never,
        boutId: 'bout-1',
        operationId: 'op-parallel',
        commandType: 'FIRST_CALL',
        payload: { corner: 'red' },
      }),
    ).rejects.toBeInstanceOf(CommandReservationRaceError)
  })

  it('finalizes command response after side effects', async () => {
    const update = vi.fn().mockResolvedValue({})
    const tx = {
      boutControlCommand: { update },
    }

    await finalizeBoutControlCommand({
      tx: tx as never,
      boutId: 'bout-1',
      operationId: 'op-1',
      responseJson: { ok: true },
      createdEventIds: ['evt-1'],
    })

    expect(update).toHaveBeenCalledWith({
      where: { boutId_operationId: { boutId: 'bout-1', operationId: 'op-1' } },
      data: {
        responseJson: { ok: true },
        createdEventIds: ['evt-1'],
      },
    })
  })
})
