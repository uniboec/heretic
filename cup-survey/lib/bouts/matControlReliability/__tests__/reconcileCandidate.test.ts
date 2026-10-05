import { describe, expect, it } from 'vitest'
import { reconcileCandidate } from '../reconcileCandidate'
import { computeEventHash } from '../hash'

function event(sequenceNo: number, commandId: string) {
  const body = {
    schemaVersion: 1,
    type: 'TECHNICAL_SCORE',
    commandId,
    sequenceNo,
    boutElapsedMs: sequenceNo * 1000,
    payload: { points: 1 },
  }
  return { ...body, eventHash: computeEventHash(body) }
}

describe('reconcileCandidate', () => {
  it('accepts matching prefix and returns suffix', () => {
    const staged = [event(1, 'c1'), event(2, 'c2')]
    const packageEvents = [event(1, 'c1'), event(2, 'c2'), event(3, 'c3')]
    const result = reconcileCandidate(staged, {
      schemaVersion: 1,
      boutId: 'b1',
      boutSessionId: 's1',
      clientSessionId: 'client',
      ownershipEpoch: 1,
      events: packageEvents,
      result: {},
      finalState: {},
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.suffix).toHaveLength(1)
      expect(result.suffix[0]?.sequenceNo).toBe(3)
    }
  })

  it('rejects prefix hash mismatch', () => {
    const staged = [event(1, 'c1')]
    const packageEvents = [event(1, 'c1-wrong')]
    const result = reconcileCandidate(staged, {
      schemaVersion: 1,
      boutId: 'b1',
      boutSessionId: 's1',
      clientSessionId: 'client',
      ownershipEpoch: 1,
      events: packageEvents,
      result: {},
      finalState: {},
    })
    expect(result.ok).toBe(false)
  })

  it('rejects when server staged exceeds client package', () => {
    const staged = [event(1, 'c1'), event(2, 'c2')]
    const result = reconcileCandidate(staged, {
      schemaVersion: 1,
      boutId: 'b1',
      boutSessionId: 's1',
      clientSessionId: 'client',
      ownershipEpoch: 1,
      events: [event(1, 'c1')],
      result: {},
      finalState: {},
    })
    expect(result.ok).toBe(false)
  })
})
