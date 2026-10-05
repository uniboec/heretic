import { describe, expect, it } from 'vitest'
import { computeAwardRequestHash } from '../idempotency'

describe('award idempotency', () => {
  it('produces stable request hash', () => {
    const payload = { operationId: 'op-1', expectedRevision: 7, status: 'AWARDED' }
    expect(computeAwardRequestHash(payload)).toBe(computeAwardRequestHash(payload))
  })

  it('changes hash when payload changes', () => {
    const left = computeAwardRequestHash({ expectedRevision: 7 })
    const right = computeAwardRequestHash({ expectedRevision: 8 })
    expect(left).not.toBe(right)
  })
})
