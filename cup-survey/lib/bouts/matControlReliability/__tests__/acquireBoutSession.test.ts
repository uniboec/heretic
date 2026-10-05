import { describe, expect, it, vi } from 'vitest'
import {
  acquireBoutSession,
  BoutAlreadyCommittedError,
  BoutSessionAlreadyActiveError,
} from '../ownership'

function createMockTx(state: {
  committed?: boolean
  activeOwnership?: {
    boutSessionId: string
    boutId: string
    clientSessionId: string
    ownershipEpoch: number
    sessionStatus: string
    releasedAt: Date | null
  } | null
  acquireCache?: Map<string, { boutSessionId: string }>
  ownershipBySession?: Map<string, Record<string, unknown>>
}) {
  const acquireCache = state.acquireCache ?? new Map()
  const ownershipBySession = state.ownershipBySession ?? new Map()

  return {
    boutResult: {
      findFirst: vi.fn(async () => (state.committed ? { id: 'r1' } : null)),
    },
    boutSessionAcquireRequest: {
      findUnique: vi.fn(async ({ where }: { where: { boutId_acquireRequestId: { acquireRequestId: string } } }) => {
        const key = where.boutId_acquireRequestId.acquireRequestId
        const row = acquireCache.get(key)
        return row ?? null
      }),
      create: vi.fn(async ({ data }: { data: { acquireRequestId: string; boutSessionId: string } }) => {
        acquireCache.set(data.acquireRequestId, { boutSessionId: data.boutSessionId })
        return data
      }),
    },
    boutSessionOwnership: {
      findFirst: vi.fn(async () => state.activeOwnership ?? null),
      findUnique: vi.fn(async ({ where }: { where: { boutSessionId: string } }) => {
        const row = ownershipBySession.get(where.boutSessionId)
        return row ?? null
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        ownershipBySession.set(String(data.boutSessionId), data)
        return data
      }),
    },
  }
}

describe('acquireBoutSession', () => {
  it('rejects acquire when bout already committed', async () => {
    const tx = createMockTx({ committed: true })
    await expect(
      acquireBoutSession(tx as never, {
        boutId: 'b1',
        acquireRequestId: '00000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toBeInstanceOf(BoutAlreadyCommittedError)
  })

  it('returns cached session for same acquireRequestId (idempotent)', async () => {
    const boutSessionId = 'sess-1'
    const tx = createMockTx({
      acquireCache: new Map([['req-1', { boutSessionId }]]),
      ownershipBySession: new Map([
        [
          boutSessionId,
          {
            boutId: 'b1',
            boutSessionId,
            clientSessionId: 'client-a',
            ownershipEpoch: 1,
            sessionStatus: 'ACTIVE',
            leasedAt: new Date(),
            releasedAt: null,
            heartbeatAt: null,
            staleAt: null,
            clockStartedAt: null,
            leasedByUserId: null,
          },
        ],
      ]),
    })

    const result = await acquireBoutSession(tx as never, {
      boutId: 'b1',
      acquireRequestId: 'req-1',
    })

    expect(result).toEqual({
      boutSessionId,
      ownershipEpoch: 1,
      clientSessionId: 'client-a',
      sessionStatus: 'ACTIVE',
    })
    expect(tx.boutSessionOwnership.create).not.toHaveBeenCalled()
  })

  it('rejects acquire after bout committed even with cached acquireRequestId', async () => {
    const boutSessionId = 'sess-committed'
    const tx = createMockTx({
      committed: true,
      acquireCache: new Map([['req-committed', { boutSessionId }]]),
      ownershipBySession: new Map([
        [
          boutSessionId,
          {
            boutId: 'b1',
            boutSessionId,
            clientSessionId: 'client-a',
            ownershipEpoch: 1,
            sessionStatus: 'COMMITTED',
            leasedAt: new Date(),
            releasedAt: new Date(),
            heartbeatAt: null,
            staleAt: null,
            clockStartedAt: null,
            leasedByUserId: null,
          },
        ],
      ]),
    })

    await expect(
      acquireBoutSession(tx as never, {
        boutId: 'b1',
        acquireRequestId: 'req-committed',
      }),
    ).rejects.toBeInstanceOf(BoutAlreadyCommittedError)
    expect(tx.boutSessionAcquireRequest.findUnique).not.toHaveBeenCalled()
  })

  it('rejects second acquire when active session exists', async () => {
    const tx = createMockTx({
      activeOwnership: {
        boutSessionId: 'sess-active',
        boutId: 'b1',
        clientSessionId: 'client-a',
        ownershipEpoch: 1,
        sessionStatus: 'ACTIVE',
        releasedAt: null,
      },
    })

    await expect(
      acquireBoutSession(tx as never, {
        boutId: 'b1',
        acquireRequestId: '00000000-0000-4000-8000-000000000002',
      }),
    ).rejects.toBeInstanceOf(BoutSessionAlreadyActiveError)
  })
})
