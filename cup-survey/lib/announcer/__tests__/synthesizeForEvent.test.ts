import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnnouncerRule, AnnouncerSetting } from '@prisma/client'

const synthesizeMock = vi.fn()
const readCachedAudioMock = vi.fn()
const writeCachedAudioMock = vi.fn()

vi.mock('../tts/registry', () => ({
  defaultVoiceForProvider: (id: string) =>
    ({
      yandex: 'marina',
      azure: 'ru-RU-DmitryNeural',
    })[id] ?? 'default',
  getTtsProvider: (id: string) => ({
    id,
    synthesize: synthesizeMock,
  }),
}))

vi.mock('../tts/storage', () => ({
  buildCacheKey: (input: { provider: string; voiceId: string }) =>
    `${input.provider}:${input.voiceId}`,
  readCachedAudio: (...args: unknown[]) => readCachedAudioMock(...args),
  writeCachedAudio: (...args: unknown[]) => writeCachedAudioMock(...args),
}))

import { synthesizeForEvent } from '../tts/synthesize'
import { testAnnouncerRule, testAnnouncerSetting } from './fixtures'

function baseSettings(): AnnouncerSetting {
  return testAnnouncerSetting({
    fallbackVoiceId1: 'ru-RU-SvetlanaNeural',
  })
}

function baseRule(overrides: Partial<AnnouncerRule> = {}): AnnouncerRule {
  return testAnnouncerRule(overrides)
}

describe('synthesizeForEvent', () => {
  beforeEach(() => {
    synthesizeMock.mockReset()
    readCachedAudioMock.mockReset()
    writeCachedAudioMock.mockReset()
    readCachedAudioMock.mockResolvedValue(null)
    writeCachedAudioMock.mockResolvedValue(undefined)
    synthesizeMock.mockResolvedValue({
      buffer: Buffer.from('audio'),
      mimeType: 'audio/mpeg',
      durationMs: 3000,
    })
  })

  it('uses global chain when rule has no override', async () => {
    const result = await synthesizeForEvent(baseSettings(), baseRule(), 'тест')
    expect(result.providerUsed).toBe('yandex')
    expect(result.voiceIdUsed).toBe('marina')
    expect(synthesizeMock).toHaveBeenCalledWith({
      text: 'тест',
      voice: 'marina',
      rate: 1,
    })
  })

  it('uses rule provider and voice when override is set', async () => {
    const result = await synthesizeForEvent(
      baseSettings(),
      baseRule({ ttsProvider: 'yandex', ttsVoiceId: 'ermil' }),
      'тест',
    )
    expect(result.providerUsed).toBe('yandex')
    expect(result.voiceIdUsed).toBe('ermil')
    expect(synthesizeMock).toHaveBeenCalledWith({
      text: 'тест',
      voice: 'ermil',
      rate: 1,
    })
  })

  it('skips duplicate provider+voice pair in global fallback', async () => {
    synthesizeMock
      .mockRejectedValueOnce(new Error('rule voice failed'))
      .mockResolvedValueOnce({
        buffer: Buffer.from('audio'),
        mimeType: 'audio/mpeg',
        durationMs: 3000,
      })

    const result = await synthesizeForEvent(
      baseSettings(),
      baseRule({ ttsProvider: 'yandex', ttsVoiceId: 'marina' }),
      'тест',
    )

    expect(result.providerUsed).toBe('azure')
    expect(result.voiceIdUsed).toBe('ru-RU-SvetlanaNeural')
    expect(synthesizeMock).toHaveBeenCalledTimes(2)
    expect(synthesizeMock.mock.calls[0][0].voice).toBe('marina')
    expect(synthesizeMock.mock.calls[1][0].voice).toBe('ru-RU-SvetlanaNeural')
  })
})
