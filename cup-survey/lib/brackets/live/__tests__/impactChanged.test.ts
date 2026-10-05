import { describe, expect, it } from 'vitest'
import { createImpactToken, impactMatches, stableJsonHash, verifyImpactToken } from '../impactToken'

describe('impact changed between preview and commit', () => {
  it('rejects stale token when live generation version bumps', () => {
    const fingerprint = stableJsonHash({ paymentStatus: 'PAID' })
    const token = verifyImpactToken(
      createImpactToken({
        version: 1,
        operation: 'admin_registration_mutation',
        mutationFingerprint: fingerprint,
        registrationId: 'reg-1',
        liveGenerationId: 'live-1',
        liveGenerationVersion: 1,
        affectedCategoryKeys: ['cat:a'],
        lockLevels: { 'cat:a': 'OPEN' },
      }),
    )

    expect(
      impactMatches(token, {
        operation: 'admin_registration_mutation',
        registrationId: 'reg-1',
        mutationFingerprint: fingerprint,
        liveGenerationId: 'live-1',
        liveGenerationVersion: 2,
        affectedCategoryKeys: ['cat:a'],
        lockLevels: { 'cat:a': 'OPEN' },
      }),
    ).toBe(false)
  })

  it('rejects when affected categories change', () => {
    const fingerprint = stableJsonHash({ field: 'x' })
    const token = verifyImpactToken(
      createImpactToken({
        version: 1,
        operation: 'standalone_force_rebuild',
        mutationFingerprint: fingerprint,
        liveGenerationId: 'live-1',
        liveGenerationVersion: 1,
        affectedCategoryKeys: ['cat:a'],
        lockLevels: { 'cat:a': 'OPEN' },
      }),
    )

    expect(
      impactMatches(token, {
        operation: 'standalone_force_rebuild',
        mutationFingerprint: fingerprint,
        liveGenerationId: 'live-1',
        liveGenerationVersion: 1,
        affectedCategoryKeys: ['cat:a', 'cat:b'],
        lockLevels: { 'cat:a': 'OPEN', 'cat:b': 'OPEN' },
      }),
    ).toBe(false)
  })
})
