import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, getAnnouncerSettingsMock } = vi.hoisted(() => ({
  prismaMock: {
    announcerEvent: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  getAnnouncerSettingsMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../settings', () => ({
  getAnnouncerSettings: getAnnouncerSettingsMock,
}))

import { claimForPlayback } from '../claimPlayback'

describe('claimForPlayback single PLAYING', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAnnouncerSettingsMock.mockResolvedValue({
      enabled: true,
      mode: 'AUTO',
      nextPlaybackAllowedAt: null,
    })
  })

  it('returns ALREADY_PLAYING when another event is active', async () => {
    prismaMock.announcerEvent.findFirst.mockResolvedValue({ id: 'playing' })
    const result = await claimForPlayback({ scopeId: 'cup-2026', eventId: 'manual-id' })
    expect(result).toEqual({ ok: false, code: 'ALREADY_PLAYING' })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
