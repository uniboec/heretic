import { describe, expect, it } from 'vitest'
import { createImpactToken, impactMatches, stableJsonHash, verifyImpactToken } from '../impactToken'

describe('impactMatches operation checklist', () => {
  const payload = {
    version: 1 as const,
    operation: 'admin_registration_mutation' as const,
    mutationFingerprint: stableJsonHash({ field: 'paymentStatus' }),
    registrationId: 'reg-1',
    liveGenerationId: 'live-1',
    liveGenerationVersion: 2,
    affectedCategoryKeys: ['cat:a', 'cat:b'],
    lockLevels: { 'cat:a': 'OPEN' as const, 'cat:b': 'RELEASED' as const },
  }

  it('rejects wrong operation', () => {
    const token = verifyImpactToken(createImpactToken(payload))
    expect(
      impactMatches(token, {
        operation: 'standalone_force_rebuild',
        registrationId: 'reg-1',
        mutationFingerprint: payload.mutationFingerprint,
        liveGenerationId: 'live-1',
        liveGenerationVersion: 2,
        affectedCategoryKeys: ['cat:a', 'cat:b'],
        lockLevels: payload.lockLevels,
      }),
    ).toBe(false)
  })

  it('rejects wrong registrationId', () => {
    const token = verifyImpactToken(createImpactToken(payload))
    expect(
      impactMatches(token, {
        operation: 'admin_registration_mutation',
        registrationId: 'reg-other',
        mutationFingerprint: payload.mutationFingerprint,
        liveGenerationId: 'live-1',
        liveGenerationVersion: 2,
        affectedCategoryKeys: ['cat:a', 'cat:b'],
        lockLevels: payload.lockLevels,
      }),
    ).toBe(false)
  })

  it('rejects version bump', () => {
    const token = verifyImpactToken(createImpactToken(payload))
    expect(
      impactMatches(token, {
        operation: 'admin_registration_mutation',
        registrationId: 'reg-1',
        mutationFingerprint: payload.mutationFingerprint,
        liveGenerationId: 'live-1',
        liveGenerationVersion: 3,
        affectedCategoryKeys: ['cat:a', 'cat:b'],
        lockLevels: payload.lockLevels,
      }),
    ).toBe(false)
  })
})
