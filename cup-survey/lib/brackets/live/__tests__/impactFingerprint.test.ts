import { describe, expect, it } from 'vitest'
import { createImpactToken, impactMatches, stableJsonHash, verifyImpactToken } from '../impactToken'

describe('impact fingerprint binding', () => {
  it('different mutation body fails impactMatches even with same categories', () => {
    const fingerprintA = stableJsonHash({ paymentStatus: 'PAID' })
    const fingerprintB = stableJsonHash({ paymentStatus: 'UNPAID' })

    const token = verifyImpactToken(
      createImpactToken({
        version: 1,
        operation: 'admin_registration_mutation',
        mutationFingerprint: fingerprintA,
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
        mutationFingerprint: fingerprintB,
        liveGenerationId: 'live-1',
        liveGenerationVersion: 1,
        affectedCategoryKeys: ['cat:a'],
        lockLevels: { 'cat:a': 'OPEN' },
      }),
    ).toBe(false)
  })
})
