import { afterEach, describe, expect, it, vi } from 'vitest'
import { isIndependentBoutsReleaseEnabled } from '../config'

describe('bouts release feature flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is disabled by default', () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', undefined)
    expect(isIndependentBoutsReleaseEnabled()).toBe(false)
  })

  it('enables Phase 2 when INDEPENDENT_BOUTS_RELEASE=true', () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    expect(isIndependentBoutsReleaseEnabled()).toBe(true)
  })

  it('enables Phase 2 when INDEPENDENT_BOUTS_RELEASE=1', () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', '1')
    expect(isIndependentBoutsReleaseEnabled()).toBe(true)
  })
})
