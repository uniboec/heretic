import { beforeEach, describe, expect, it, vi } from 'vitest'
import { testAnnouncerEvent } from './fixtures'

const { prismaMock, isEventStillValidMock } = vi.hoisted(() => ({
  prismaMock: {
    announcerEvent: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  isEventStillValidMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../validityContext', () => ({
  buildValidityContext: vi.fn().mockResolvedValue({}),
}))
vi.mock('../validity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../validity')>()
  return {
    ...actual,
    isEventStillValid: isEventStillValidMock,
  }
})
vi.mock('../expireEvents', () => ({
  expireAnnouncerEvent: vi.fn().mockResolvedValue(true),
}))

import { heartbeatPlayback } from '../claimPlayback'

describe('heartbeatPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isEventStillValidMock.mockReturnValue(true)
  })

  it('extends lease to max(existing, now + 30s)', async () => {
    const futureLease = new Date(Date.now() + 120_000)
    prismaMock.announcerEvent.findFirst.mockResolvedValue(
      testAnnouncerEvent({
        id: 'e1',
        status: 'PLAYING',
        leaseUntil: futureLease,
      }),
    )
    prismaMock.announcerEvent.updateMany.mockResolvedValue({ count: 1 })

    const ok = await heartbeatPlayback({
      scopeId: 'cup-2026',
      eventId: 'e1',
      claimToken: 'token',
    })

    expect(ok).toBe(true)
    const updateArg = prismaMock.announcerEvent.updateMany.mock.calls[0][0]
    const extended: Date = updateArg.data.leaseUntil
    expect(extended.getTime()).toBeGreaterThanOrEqual(futureLease.getTime())
  })
})
