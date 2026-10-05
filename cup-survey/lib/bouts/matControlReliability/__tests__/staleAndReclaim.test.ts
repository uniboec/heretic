import { describe, expect, it, vi } from 'vitest'
import {
  BOUT_SESSION_HEARTBEAT_STALE_MS,
  markStaleSessionsFromHeartbeatTimeout,
  reclaimBoutSession,
  BoutSessionReclaimForbiddenError,
} from '../ownership'

describe('stale and reclaim', () => {
  it('marks sessions stale after heartbeat timeout', async () => {
    const updateMany = vi.fn(async () => ({ count: 2 }))
    const tx = { boutSessionOwnership: { updateMany } }
    const now = new Date('2026-10-05T12:00:00.000Z')
    const count = await markStaleSessionsFromHeartbeatTimeout(tx as never, now)
    expect(count).toBe(2)
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        releasedAt: null,
        sessionStatus: { in: ['ACTIVE', 'REJECTED_VALIDATION'] },
        staleAt: null,
        heartbeatAt: {
          lt: new Date(now.getTime() - BOUT_SESSION_HEARTBEAT_STALE_MS),
        },
      },
      data: { staleAt: now },
    })
  })

  it('rejects reclaim while COMMITTING', async () => {
    const tx = {
      boutSessionOwnership: {
        findFirst: vi.fn(async () => ({
          boutSessionId: 's1',
          sessionStatus: 'COMMITTING',
          staleAt: null,
        })),
      },
    }
    await expect(
      reclaimBoutSession(tx as never, {
        boutId: 'b1',
        boutSessionId: 's1',
        status: 'EXPIRED',
        reason: 'STALE_SESSION_RECLAIM',
      }),
    ).rejects.toBeInstanceOf(BoutSessionReclaimForbiddenError)
  })
})
