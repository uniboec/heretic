import { describe, expect, it, vi } from 'vitest'
import { validateReliabilityFencing } from '../applyReliabilityCommand'
import { SessionSupersededError } from '../ownership'
import { BoutAlreadyCommittedError } from '../../mat-control/errors'

function baseOwnership(overrides: Record<string, unknown> = {}) {
  return {
    boutId: 'b1',
    boutSessionId: 'sess-1',
    clientSessionId: 'client-a',
    ownershipEpoch: 2,
    sessionStatus: 'ACTIVE',
    leasedAt: new Date(),
    releasedAt: null,
    heartbeatAt: null,
    staleAt: null,
    clockStartedAt: null,
    leasedByUserId: null,
    expectedSequenceNo: 3,
    ...overrides,
  }
}

describe('validateReliabilityFencing', () => {
  it('rejects superseded ownership epoch', async () => {
    const tx = {
      boutSessionOwnership: {
        findUnique: vi.fn(async () => baseOwnership()),
      },
      boutControlCommand: { findUnique: vi.fn(async () => null) },
    }

    await expect(
      validateReliabilityFencing(tx as never, {
        boutId: 'b1',
        commandId: 'op-1',
        boutSessionId: 'sess-1',
        clientSessionId: 'client-a',
        ownershipEpoch: 1,
        sequenceNo: 3,
        intent: 'CLOCK_START',
        payload: {},
        payloadHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(SessionSupersededError)
  })

  it('rejects commands on terminal committed session without duplicate operationId', async () => {
    const tx = {
      boutSessionOwnership: {
        findUnique: vi.fn(async () =>
          baseOwnership({ sessionStatus: 'COMMITTED', releasedAt: new Date() }),
        ),
      },
      boutControlCommand: { findUnique: vi.fn(async () => null) },
    }

    await expect(
      validateReliabilityFencing(tx as never, {
        boutId: 'b1',
        commandId: 'op-2',
        boutSessionId: 'sess-1',
        clientSessionId: 'client-a',
        ownershipEpoch: 2,
        sequenceNo: 3,
        intent: 'CONFIRM',
        payload: {},
        payloadHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(BoutAlreadyCommittedError)
  })
})
