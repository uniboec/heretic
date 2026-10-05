import { describe, expect, it } from 'vitest'
import {
  createImpactToken,
  impactMatches,
  stableJsonHash,
  verifyImpactToken,
} from '../impactToken'
import { ImpactTokenExpiredError, ImpactTokenInvalidError } from '../errors'

describe('impactToken', () => {
  const basePayload = {
    version: 1 as const,
    operation: 'standalone_force_rebuild' as const,
    mutationFingerprint: stableJsonHash({ categoryKeys: ['cat:a'] }),
    categoryKeys: ['cat:a'],
    liveGenerationId: 'gen-1',
    liveGenerationVersion: 3,
    affectedCategoryKeys: ['cat:a'],
    lockLevels: { 'cat:a': 'OPEN' as const },
  }

  it('round-trips a signed token', () => {
    const token = createImpactToken(basePayload)
    const parsed = verifyImpactToken(token)
    expect(parsed.liveGenerationId).toBe('gen-1')
    expect(parsed.affectedCategoryKeys).toEqual(['cat:a'])
  })

  it('rejects tampered signature', () => {
    const token = createImpactToken(basePayload)
    const [payload] = token.split('.')
    expect(() => verifyImpactToken(`${payload}.bad-signature`)).toThrow(ImpactTokenInvalidError)
  })

  it('rejects expired token', () => {
    const token = createImpactToken({
      ...basePayload,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    })
    expect(() => verifyImpactToken(token)).toThrow(ImpactTokenExpiredError)
  })

  it('impactMatches validates full checklist', () => {
    const token = verifyImpactToken(createImpactToken(basePayload))
    expect(
      impactMatches(token, {
        operation: 'standalone_force_rebuild',
        mutationFingerprint: basePayload.mutationFingerprint,
        liveGenerationId: 'gen-1',
        liveGenerationVersion: 3,
        affectedCategoryKeys: ['cat:a'],
        lockLevels: { 'cat:a': 'OPEN' },
      }),
    ).toBe(true)
  })
})
