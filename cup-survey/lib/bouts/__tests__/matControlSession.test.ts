import { describe, expect, it } from 'vitest'
import { assertMatControlLease } from '../matControlSession'
import { LeaseNotHeldError, LeaseStaleError } from '../mat-control/errors'

const baseSession = {
  tournamentScopeId: 'cup-2026',
  matIndex: 1,
  activeBoutId: null,
  revision: 1,
  holderToken: 'token-a',
  holderSince: new Date('2026-09-30T10:00:00Z'),
  heartbeatAt: new Date('2026-09-30T10:00:00Z'),
  expiresAt: new Date('2026-09-30T10:01:30Z'),
}

describe('matControlSession', () => {
  it('accepts valid holder token before expiry', () => {
    expect(() =>
      assertMatControlLease(baseSession, 'token-a', new Date('2026-09-30T10:01:00Z')),
    ).not.toThrow()
  })

  it('rejects stale lease after expiry', () => {
    expect(() =>
      assertMatControlLease(baseSession, 'token-a', new Date('2026-09-30T10:02:00Z')),
    ).toThrow(LeaseStaleError)
  })

  it('rejects foreign holder token', () => {
    expect(() =>
      assertMatControlLease(baseSession, 'token-b', new Date('2026-09-30T10:01:00Z')),
    ).toThrow(LeaseNotHeldError)
  })
})
