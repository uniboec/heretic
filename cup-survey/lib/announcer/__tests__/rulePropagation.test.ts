import { describe, expect, it, vi } from 'vitest'
import { finalizeAfterGeneration } from '../rulePropagation'

function mockTx(updateMany: ReturnType<typeof vi.fn>) {
  return {
    announcerSetting: {
      findUnique: vi.fn().mockResolvedValue({
        enabled: true,
        primaryProvider: 'yandex',
        primaryVoiceId: 'marina',
        fallbackProvider1: null,
        fallbackVoiceId1: null,
        fallbackProvider2: null,
        fallbackVoiceId2: null,
        speechRate: 1,
      }),
    },
    announcerRule: {
      findUnique: vi.fn().mockResolvedValue({
        enabled: true,
        priority: 100,
        ttsProvider: null,
        ttsVoiceId: null,
      }),
    },
    announcerEvent: { updateMany },
  }
}

describe('finalizeAfterGeneration', () => {
  it('does not update when generation token mismatches', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 })
    const tx = mockTx(updateMany)

    const status = await finalizeAfterGeneration(tx as never, {
      eventId: 'e1',
      generationToken: 'stale-token',
      generationTtsSignature: 'global|yandex:marina|1',
      tournamentScopeId: 'cup-2026',
      eventType: 'BOUT_CALL',
      audioCacheKey: 'cache',
      audioDurationMs: 3000,
      textSnapshot: 'text',
      providerUsed: 'yandex',
      voiceIdUsed: 'marina',
    })

    expect(status).toBe('SKIPPED')
    expect(updateMany).toHaveBeenCalled()
  })

  it('marks READY when token matches and rule enabled', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const tx = mockTx(updateMany)

    const status = await finalizeAfterGeneration(tx as never, {
      eventId: 'e1',
      generationToken: 'valid',
      generationTtsSignature: 'global|yandex:marina|1',
      tournamentScopeId: 'cup-2026',
      eventType: 'BOUT_CALL',
      audioCacheKey: 'cache',
      audioDurationMs: 3000,
      textSnapshot: 'text',
      providerUsed: 'yandex',
      voiceIdUsed: 'marina',
    })

    expect(status).toBe('READY')
  })
})
