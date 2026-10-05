import { describe, expect, it, vi } from 'vitest'
import { updateAnnouncerSettings } from '../settings'

const invalidateGlobalDefaultVoiceEvents = vi.fn()

vi.mock('../rulePropagation', () => ({
  invalidateGlobalDefaultVoiceEvents: (...args: unknown[]) =>
    invalidateGlobalDefaultVoiceEvents(...args),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    announcerSetting: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        announcerSetting: {
          update: vi.fn().mockResolvedValue({
            tournamentScopeId: 'cup-2026',
            primaryProvider: 'azure',
            primaryVoiceId: 'ru-RU-SvetlanaNeural',
            speechRate: 1,
          }),
        },
      }),
    ),
  },
}))

describe('updateAnnouncerSettings voice invalidation', () => {
  it('invalidates global-default events when TTS settings change', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.announcerSetting.findUnique).mockResolvedValue({
      tournamentScopeId: 'cup-2026',
      enabled: true,
      mode: 'AUTO',
      primaryProvider: 'yandex',
      primaryVoiceId: 'marina',
      fallbackProvider1: 'azure',
      fallbackVoiceId1: null,
      fallbackProvider2: null,
      fallbackVoiceId2: null,
      speechRate: 1,
      announcementGapMs: 3000,
      cueToSpeechGapMs: 700,
      nextPlaybackAllowedAt: null,
      boutCueSoundId: 'universfield-032',
      awardCueSoundId: 'chime-01',
      cueVolume: 0.7,
      updatedAt: new Date(),
    })

    await updateAnnouncerSettings({ primaryProvider: 'azure' }, 'cup-2026')

    expect(invalidateGlobalDefaultVoiceEvents).toHaveBeenCalled()
  })

  it('does not invalidate when unrelated settings change', async () => {
    invalidateGlobalDefaultVoiceEvents.mockClear()
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.announcerSetting.findUnique).mockResolvedValue({
      tournamentScopeId: 'cup-2026',
      enabled: true,
      mode: 'AUTO',
      primaryProvider: 'yandex',
      primaryVoiceId: 'marina',
      fallbackProvider1: 'azure',
      fallbackVoiceId1: null,
      fallbackProvider2: null,
      fallbackVoiceId2: null,
      speechRate: 1,
      announcementGapMs: 3000,
      cueToSpeechGapMs: 700,
      nextPlaybackAllowedAt: null,
      boutCueSoundId: 'universfield-032',
      awardCueSoundId: 'chime-01',
      cueVolume: 0.7,
      updatedAt: new Date(),
    })

    await updateAnnouncerSettings({ announcementGapMs: 5000 }, 'cup-2026')

    expect(invalidateGlobalDefaultVoiceEvents).not.toHaveBeenCalled()
  })
})
