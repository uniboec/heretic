import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, getAnnouncerSettingsMock, buildValidityContextMock } = vi.hoisted(() => ({
  prismaMock: {
    announcerEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    announcerRule: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  getAnnouncerSettingsMock: vi.fn(),
  buildValidityContextMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../validityContext', () => ({
  buildValidityContext: buildValidityContextMock,
}))
vi.mock('../settings', () => ({
  getAnnouncerSettings: getAnnouncerSettingsMock,
}))

import { claimForPlayback, completePlayback } from '../claimPlayback'

describe('claimPlayback gap gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildValidityContextMock.mockResolvedValue({ boutQueueByMat: { 1: ['b1'] } })
  })

  it('blocks claim while nextPlaybackAllowedAt is in the future', async () => {
    getAnnouncerSettingsMock.mockResolvedValue({
      tournamentScopeId: 'cup-2026',
      enabled: true,
      mode: 'AUTO',
      primaryProvider: 'yandex',
      primaryVoiceId: null,
      fallbackProvider1: null,
      fallbackVoiceId1: null,
      fallbackProvider2: null,
      fallbackVoiceId2: null,
      speechRate: 1,
      announcementGapMs: 3000,
      cueToSpeechGapMs: 700,
      nextPlaybackAllowedAt: new Date(Date.now() + 60_000),
      boutCueSoundId: 'universfield-032',
      awardCueSoundId: 'chime-01',
      cueVolume: 0.7,
      updatedAt: new Date(),
    })

    const result = await claimForPlayback({ scopeId: 'cup-2026', requireAuto: true })
    expect(result).toEqual({ ok: false, code: 'GAP_ACTIVE' })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('sets nextPlaybackAllowedAt on complete', async () => {
    getAnnouncerSettingsMock.mockResolvedValue({
      tournamentScopeId: 'cup-2026',
      enabled: true,
      mode: 'AUTO',
      primaryProvider: 'yandex',
      primaryVoiceId: null,
      fallbackProvider1: null,
      fallbackVoiceId1: null,
      fallbackProvider2: null,
      fallbackVoiceId2: null,
      speechRate: 1,
      announcementGapMs: 5000,
      cueToSpeechGapMs: 700,
      nextPlaybackAllowedAt: null,
      boutCueSoundId: 'universfield-032',
      awardCueSoundId: 'chime-01',
      cueVolume: 0.7,
      updatedAt: new Date(),
    })

    const announcerSettingUpdate = vi.fn()
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<boolean>) =>
      fn({
        announcerEvent: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        announcerSetting: { update: announcerSettingUpdate },
      }),
    )

    const ok = await completePlayback({
      scopeId: 'cup-2026',
      eventId: 'e1',
      claimToken: 'token',
    })
    expect(ok).toBe(true)
    expect(announcerSettingUpdate).toHaveBeenCalled()
  })
})
