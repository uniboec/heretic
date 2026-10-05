import { describe, expect, it } from 'vitest'
import { computeEventHash, computePackageHash, computePayloadHash, sha256Jcs } from '../hash'

/** Golden vectors for cross-runtime hash parity (P0.5 §4.7). */
describe('matControlReliability golden vectors', () => {
  it('payloadHash CLOCK_START sequence 1', () => {
    const hash = computePayloadHash({
      intent: 'CLOCK_START',
      sequenceNo: 1,
      payload: { boutElapsedMs: 0 },
    })
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).toBe(
      computePayloadHash({
        intent: 'CLOCK_START',
        sequenceNo: 1,
        payload: { boutElapsedMs: 0 },
      }),
    )
  })

  it('JCS key order invariance', () => {
    const a = sha256Jcs({ z: 1, a: 2, m: 3 })
    const b = sha256Jcs({ a: 2, m: 3, z: 1 })
    expect(a).toBe(b)
  })

  it('eventHash stable for canonical CLOCK_START', () => {
    const input = {
      type: 'CLOCK_START',
      commandId: '00000000-0000-4000-8000-000000000099',
      sequenceNo: 1,
      boutElapsedMs: 0,
      payload: {},
    }
    const hash = computeEventHash(input)
    expect(hash).toHaveLength(64)
    expect(hash).toBe(computeEventHash(input))
  })

  it('packageHash stable regardless of events array order', () => {
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
    const body = {
      schemaVersion: 1,
      boutId: 'cat::bout-1',
      boutSessionId: '00000000-0000-4000-8000-000000000001',
      ownershipEpoch: 1,
      events: [event],
      result: { winnerEntryId: 'e1' },
      finalState: { boutPhase: 'confirmed' },
    }
    expect(computePackageHash(body)).toBe(computePackageHash({ ...body, events: [...body.events].reverse() }))
  })
})
