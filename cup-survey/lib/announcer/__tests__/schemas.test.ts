import { describe, expect, it } from 'vitest'
import { AnnouncerRulePatchSchema, AnnouncerSettingsPatchSchema } from '../schemas'

describe('AnnouncerSettingsPatchSchema', () => {
  it('accepts valid gap and volume', () => {
    expect(
      AnnouncerSettingsPatchSchema.safeParse({
        announcementGapMs: 3000,
        cueToSpeechGapMs: 700,
        cueVolume: 0.7,
        speechRate: 1,
      }).success,
    ).toBe(true)
  })

  it('rejects out-of-range values', () => {
    expect(AnnouncerSettingsPatchSchema.safeParse({ announcementGapMs: 20_000 }).success).toBe(false)
    expect(AnnouncerSettingsPatchSchema.safeParse({ cueVolume: 2 }).success).toBe(false)
    expect(AnnouncerSettingsPatchSchema.safeParse({ speechRate: 2 }).success).toBe(false)
  })
})

describe('AnnouncerRulePatchSchema', () => {
  it('accepts valid tts provider', () => {
    expect(
      AnnouncerRulePatchSchema.safeParse({ ttsProvider: 'yandex', ttsVoiceId: 'ermil' }).success,
    ).toBe(true)
  })

  it('rejects unknown tts provider', () => {
    expect(AnnouncerRulePatchSchema.safeParse({ ttsProvider: 'yadnex' }).success).toBe(false)
  })

  it('accepts null tts provider for default mode', () => {
    expect(AnnouncerRulePatchSchema.safeParse({ ttsProvider: null }).success).toBe(true)
  })
})
