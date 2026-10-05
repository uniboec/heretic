import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AnnouncerEvent } from '@prisma/client'
import { expireStaleAnnouncerEvents } from '../expireEvents'
import { testAnnouncerEvent } from './fixtures'

const { prismaMock, getRuleForTypeMock } = vi.hoisted(() => ({
  prismaMock: {
    announcerEvent: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  getRuleForTypeMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../rules', () => ({ getRuleForType: getRuleForTypeMock }))

function pendingEvent(overrides: Partial<AnnouncerEvent> = {}): AnnouncerEvent {
  return testAnnouncerEvent({
    status: 'READY',
    expiresAt: new Date(Date.now() - 60_000),
    type: 'BOUT_CALL',
    payload: { boutId: 'b1', matIndex: 1 },
    ...overrides,
  })
}

describe('expireStaleAnnouncerEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRuleForTypeMock.mockResolvedValue({ ttlSeconds: 75 })
    prismaMock.announcerEvent.updateMany.mockResolvedValue({ count: 1 })
  })

  it('extends TTL instead of expiring when the event is still valid', async () => {
    prismaMock.announcerEvent.findMany.mockResolvedValue([pendingEvent()])

    const expiredCount = await expireStaleAnnouncerEvents('cup-2026', {
      boutQueueByMat: { 1: ['b1', 'b2'] },
    })

    expect(expiredCount).toBe(0)
    expect(prismaMock.announcerEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: expect.any(Date) }),
      }),
    )
  })

  it('expires events that are no longer valid after TTL', async () => {
    prismaMock.announcerEvent.findMany.mockResolvedValue([pendingEvent()])

    const expiredCount = await expireStaleAnnouncerEvents('cup-2026', {
      boutQueueByMat: { 1: ['b2', 'b3'] },
    })

    expect(expiredCount).toBe(1)
    expect(prismaMock.announcerEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'EXPIRED' }),
      }),
    )
  })

  it('expires invalid queued events immediately even before TTL', async () => {
    prismaMock.announcerEvent.findMany.mockResolvedValue([
      pendingEvent({
        status: 'QUEUED',
        expiresAt: new Date(Date.now() + 60_000),
        payload: { boutId: 'old-bout', matIndex: 1 },
      }),
    ])

    const expiredCount = await expireStaleAnnouncerEvents('cup-2026', {
      boutQueueByMat: { 1: ['new-bout', 'next-bout'] },
    })

    expect(expiredCount).toBe(1)
    expect(prismaMock.announcerEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'QUEUED' }),
        data: expect.objectContaining({ status: 'EXPIRED' }),
      }),
    )
  })

  it('expires stale award call when category is no longer first in queue', async () => {
    prismaMock.announcerEvent.findMany.mockResolvedValue([
      pendingEvent({
        status: 'READY',
        type: 'AWARD_CALL',
        expiresAt: new Date(Date.now() + 120_000),
        payload: { queueId: 'award-old', placements: [] },
      }),
    ])

    const expiredCount = await expireStaleAnnouncerEvents('cup-2026', {
      orderedAwardQueueIds: ['award-new', 'award-next'],
    })

    expect(expiredCount).toBe(1)
  })

  it('expires repeat events after TTL instead of extending them', async () => {
    prismaMock.announcerEvent.findMany.mockResolvedValue([
      pendingEvent({
        status: 'READY',
        type: 'AWARD_CALL',
        dedupeKey: 'AWARD_REPEAT:category_call:award-1:all:uuid',
        expiresAt: new Date(Date.now() - 60_000),
        payload: {
          queueId: 'award-1',
          repeatCategory: true,
          repeatLogicalKey: 'AWARD_REPEAT:category_call:award-1:all',
          placements: [],
        },
      }),
    ])

    const expiredCount = await expireStaleAnnouncerEvents('cup-2026', {
      orderedAwardQueueIds: ['award-1', 'award-2'],
    })

    expect(expiredCount).toBe(1)
    expect(prismaMock.announcerEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'EXPIRED' }),
      }),
    )
  })

  it('expires invalid playing events immediately', async () => {
    prismaMock.announcerEvent.findMany.mockResolvedValue([
      pendingEvent({
        status: 'PLAYING',
        type: 'BOUT_PREPARE',
        expiresAt: new Date(Date.now() + 120_000),
        payload: { boutId: 'stale-bout', matIndex: 1 },
      }),
    ])

    const expiredCount = await expireStaleAnnouncerEvents('cup-2026', {
      boutQueueByMat: { 1: ['current-bout', 'next-bout'] },
    })

    expect(expiredCount).toBe(1)
  })

  it('expires stale bout result when result is no longer current', async () => {
    prismaMock.announcerEvent.findMany.mockResolvedValue([
      pendingEvent({
        status: 'READY',
        type: 'BOUT_RESULT',
        expiresAt: new Date(Date.now() + 120_000),
        payload: { boutId: 'b1', boutResultId: 'old-result' },
      }),
    ])

    const expiredCount = await expireStaleAnnouncerEvents('cup-2026', {
      currentBoutResultIdByBout: { b1: 'new-result' },
    })

    expect(expiredCount).toBe(1)
  })
})
