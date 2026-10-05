import { describe, expect, it, vi } from 'vitest'
import { finalizeAfterGeneration } from '../rulePropagation'

function baseSettings() {
  return {
    enabled: true,
    primaryProvider: 'yandex',
    primaryVoiceId: 'marina',
    fallbackProvider1: 'azure',
    fallbackVoiceId1: 'ru-RU-DmitryNeural',
    fallbackProvider2: null,
    fallbackVoiceId2: null,
    speechRate: 1,
  }
}

function baseRule(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    priority: 100,
    ttsProvider: null,
    ttsVoiceId: null,
    ...overrides,
  }
}

describe('finalizeAfterGeneration voice signature', () => {
  it('requeues when signature changed during generation', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const tx = {
      announcerSetting: { findUnique: vi.fn().mockResolvedValue(baseSettings()) },
      announcerRule: {
        findUnique: vi.fn().mockResolvedValue(
          baseRule({ ttsProvider: 'azure', ttsVoiceId: 'ru-RU-SvetlanaNeural' }),
        ),
      },
      announcerEvent: { updateMany },
    }

    const status = await finalizeAfterGeneration(tx as never, {
      eventId: 'e1',
      generationToken: 'valid',
      generationTtsSignature: 'yandex|marina|1',
      tournamentScopeId: 'cup-2026',
      eventType: 'BOUT_CALL',
      audioCacheKey: 'cache',
      audioDurationMs: 3000,
      textSnapshot: 'text',
      providerUsed: 'yandex',
      voiceIdUsed: 'marina',
    })

    expect(status).toBe('REQUEUED')
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'e1',
        status: 'GENERATING',
        generationToken: 'valid',
      },
      data: expect.objectContaining({
        status: 'QUEUED',
        audioCacheKey: null,
        generationTtsSignature: null,
      }),
    })
  })

  it('skips signature check when generationTtsSignature is empty', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const tx = {
      announcerSetting: { findUnique: vi.fn().mockResolvedValue(baseSettings()) },
      announcerRule: {
        findUnique: vi.fn().mockResolvedValue(
          baseRule({ ttsProvider: 'azure', ttsVoiceId: 'ru-RU-SvetlanaNeural' }),
        ),
      },
      announcerEvent: { updateMany },
    }

    const status = await finalizeAfterGeneration(tx as never, {
      eventId: 'e1',
      generationToken: 'valid',
      generationTtsSignature: '',
      tournamentScopeId: 'cup-2026',
      eventType: 'BOUT_CALL',
      audioCacheKey: 'cache',
      audioDurationMs: 3000,
      textSnapshot: 'text',
      providerUsed: 'azure',
      voiceIdUsed: 'ru-RU-DmitryNeural',
    })

    expect(status).toBe('READY')
  })

  it('stores actual provider and voice when signature matches', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const tx = {
      announcerSetting: { findUnique: vi.fn().mockResolvedValue(baseSettings()) },
      announcerRule: {
        findUnique: vi.fn().mockResolvedValue(
          baseRule({ ttsProvider: 'yandex', ttsVoiceId: 'ermil' }),
        ),
      },
      announcerEvent: { updateMany },
    }

    const status = await finalizeAfterGeneration(tx as never, {
      eventId: 'e1',
      generationToken: 'valid',
      generationTtsSignature: 'yandex|ermil|1',
      tournamentScopeId: 'cup-2026',
      eventType: 'BOUT_CALL',
      audioCacheKey: 'cache',
      audioDurationMs: 3000,
      textSnapshot: 'text',
      providerUsed: 'yandex',
      voiceIdUsed: 'ermil',
    })

    expect(status).toBe('READY')
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'e1',
        status: 'GENERATING',
        generationToken: 'valid',
      },
      data: expect.objectContaining({
        status: 'READY',
        ttsProviderUsed: 'yandex',
        ttsVoiceIdUsed: 'ermil',
      }),
    })
  })
})
