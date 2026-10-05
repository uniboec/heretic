import { describe, expect, it } from 'vitest'
import type { AnnouncerRule, AnnouncerSetting } from '@prisma/client'
import { resolveCueForEvent } from '../cues'
import { testAnnouncerRule, testAnnouncerSetting } from './fixtures'

function settings(overrides: Partial<AnnouncerSetting> = {}): AnnouncerSetting {
  return testAnnouncerSetting(overrides)
}

function rule(overrides: Partial<AnnouncerRule> = {}): AnnouncerRule {
  return testAnnouncerRule({
    includeCorner: true,
    includeMethod: false,
    includePlacement: false,
    includeAge: true,
    includeWeight: true,
    includeCueSound: true,
    ttlSeconds: 75,
    ...overrides,
  })
}

describe('resolveCueForEvent', () => {
  it('returns cue when includeCueSound=true', () => {
    const cue = resolveCueForEvent('BOUT_CALL', settings(), rule())
    expect(cue?.soundId).toBe('universfield-032')
    expect(cue?.durationMs).toBeGreaterThan(0)
  })

  it('returns null when includeCueSound=false', () => {
    const cue = resolveCueForEvent('BOUT_CALL', settings(), rule({ includeCueSound: false }))
    expect(cue).toBeNull()
  })

  it('uses per-rule cueSoundId when set', () => {
    const cue = resolveCueForEvent(
      'BOUT_CALL',
      settings(),
      rule({ includeCueSound: true, cueSoundId: 'soft-alert' }),
    )
    expect(cue?.soundId).toBe('soft-alert')
  })
})
