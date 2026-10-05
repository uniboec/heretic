import { describe, expect, it } from 'vitest'
import { assertFencedOwner, mapOwnershipRow } from '../ownership'

describe('ownership fencing', () => {
  const ownership = mapOwnershipRow({
    boutId: 'b1',
    boutSessionId: 's1',
    clientSessionId: 'client-a',
    ownershipEpoch: 3,
    sessionStatus: 'ACTIVE',
    leasedAt: new Date(),
    releasedAt: null,
    heartbeatAt: null,
    staleAt: null,
    clockStartedAt: null,
    leasedByUserId: null,
  })

  it('accepts matching epoch and client session', () => {
    expect(() =>
      assertFencedOwner(ownership, { clientSessionId: 'client-a', ownershipEpoch: 3 }),
    ).not.toThrow()
  })

  it('rejects superseded epoch', () => {
    expect(() =>
      assertFencedOwner(ownership, { clientSessionId: 'client-a', ownershipEpoch: 2 }),
    ).toThrow()
  })
})
