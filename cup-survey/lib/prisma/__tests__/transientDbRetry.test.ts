import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  isTransientPrismaConnectionError,
  withTransientDbRetry,
} from '../transientDbRetry'

describe('isTransientPrismaConnectionError', () => {
  it('detects Prisma P1001 connection errors', () => {
    const error = new Prisma.PrismaClientKnownRequestError('unreachable', {
      code: 'P1001',
      clientVersion: '6.19.3',
    })
    expect(isTransientPrismaConnectionError(error)).toBe(true)
  })

  it('ignores non-connection Prisma errors', () => {
    const error = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: '6.19.3',
    })
    expect(isTransientPrismaConnectionError(error)).toBe(false)
  })
})

describe('withTransientDbRetry', () => {
  it('retries transient failures and eventually succeeds', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unreachable', {
          code: 'P1001',
          clientVersion: '6.19.3',
        }),
      )
      .mockResolvedValueOnce('ok')

    const result = await withTransientDbRetry(operation, { attempts: 2, delayMs: 1 })

    expect(result).toBe('ok')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-transient failures', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('validation failed'))

    await expect(withTransientDbRetry(operation, { attempts: 3, delayMs: 1 })).rejects.toThrow(
      'validation failed',
    )
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
