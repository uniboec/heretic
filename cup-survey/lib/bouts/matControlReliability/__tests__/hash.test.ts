import { describe, expect, it } from 'vitest'
import { computeEventHash, computePackageHash, computePayloadHash, sha256Jcs } from '../hash'

describe('matControlReliability/hash', () => {
  it('produces stable hash regardless of key order', () => {
    const a = sha256Jcs({ b: 2, a: 1 })
    const b = sha256Jcs({ a: 1, b: 2 })
    expect(a).toBe(b)
  })

  it('excludes transport hash fields from preimage', () => {
    const without = sha256Jcs({ schemaVersion: 1, intent: 'CLOCK_START', payload: {} })
    const withHint = sha256Jcs({
      schemaVersion: 1,
      intent: 'CLOCK_START',
      payload: {},
      payloadHash: 'deadbeef',
      packageHash: 'deadbeef',
      checksum: 'deadbeef',
      eventHash: 'deadbeef',
    })
    expect(without).toBe(withHint)
  })

  it('computes payload and event hashes', () => {
    const payloadHash = computePayloadHash({
      intent: 'TECHNICAL_SCORE',
      sequenceNo: 1,
      payload: { points: 1 },
    })
    expect(payloadHash).toHaveLength(64)

    const eventHash = computeEventHash({
      type: 'TECHNICAL_SCORE',
      commandId: 'cmd-1',
      sequenceNo: 1,
      boutElapsedMs: 1000,
      payload: { points: 1 },
    })
    expect(eventHash).toHaveLength(64)
  })

  it('sorts events by sequenceNo in package hash', () => {
    const event = {
      schemaVersion: 1,
      type: 'CLOCK_START',
      commandId: 'c1',
      sequenceNo: 1,
      boutElapsedMs: 0,
      payload: {},
      eventHash: computeEventHash({
        type: 'CLOCK_START',
        commandId: 'c1',
        sequenceNo: 1,
        boutElapsedMs: 0,
        payload: {},
      }),
    }
    const base = {
      schemaVersion: 1,
      boutId: 'b1',
      boutSessionId: 's1',
      ownershipEpoch: 1,
      events: [event],
      result: { winnerEntryId: 'e1' },
      finalState: { boutPhase: 'confirmed' },
    }
    const forward = computePackageHash(base)
    const reversed = computePackageHash({ ...base, events: [...base.events].reverse() })
    expect(forward).toBe(reversed)
  })
})
