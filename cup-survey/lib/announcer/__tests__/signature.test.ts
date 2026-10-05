import { describe, expect, it } from 'vitest'
import { buildGlobalTtsSignature, buildTtsSignature } from '../tts/signature'
import type { AnnouncerRule, AnnouncerSetting } from '@prisma/client'
import { testAnnouncerRule, testAnnouncerSetting } from './fixtures'

function baseSettings(overrides: Partial<AnnouncerSetting> = {}): AnnouncerSetting {
  return testAnnouncerSetting({
    fallbackVoiceId1: 'ru-RU-DmitryNeural',
    ...overrides,
  })
}

function baseRule(overrides: Partial<AnnouncerRule> = {}): AnnouncerRule {
  return testAnnouncerRule(overrides)
}

describe('buildTtsSignature', () => {
  it('builds global signature when rule has no override', () => {
    const signature = buildTtsSignature(baseSettings(), baseRule())
    expect(signature).toBe('global|yandex:marina>azure:ru-RU-DmitryNeural|1')
  })

  it('builds rule signature when provider override is set', () => {
    const signature = buildTtsSignature(
      baseSettings(),
      baseRule({ ttsProvider: 'yandex', ttsVoiceId: 'ermil' }),
    )
    expect(signature).toBe('yandex|ermil|1')
  })

  it('uses provider default voice in signature when voice id is null', () => {
    const signature = buildTtsSignature(
      baseSettings(),
      baseRule({ ttsProvider: 'azure', ttsVoiceId: null }),
    )
    expect(signature).toBe('azure|ru-RU-DmitryNeural|1')
  })

  it('changes global signature when global settings change', () => {
    const first = buildGlobalTtsSignature(baseSettings())
    const second = buildGlobalTtsSignature(
      baseSettings({ primaryVoiceId: 'jane', speechRate: 1.1 }),
    )
    expect(first).not.toBe(second)
  })
})
