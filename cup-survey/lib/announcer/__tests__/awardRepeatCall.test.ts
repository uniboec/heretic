import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnnouncerEvent } from '@prisma/client'
import {
  buildAwardRepeatLogicalKey,
  findPendingAwardRepeatCall,
} from '../hooks/awardRepeatCall'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    announcerEvent: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

describe('awardRepeatCall dedupe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds stable logical keys per button target', () => {
    expect(
      buildAwardRepeatLogicalKey({
        kind: 'category_call',
        queueId: 'queue-1',
      }),
    ).toBe('AWARD_REPEAT:category_call:queue-1:all')
    expect(
      buildAwardRepeatLogicalKey({
        kind: 'placement',
        queueId: 'queue-1',
        placementId: 'placement-2',
      }),
    ).toBe('AWARD_REPEAT:placement:queue-1:placement-2')
  })

  it('finds pending placement repeat by placement id', async () => {
    const pending = { id: 'event-1' } as AnnouncerEvent
    prismaMock.announcerEvent.findFirst.mockResolvedValue(pending)

    const result = await findPendingAwardRepeatCall({
      scopeId: 'cup-2026',
      kind: 'placement',
      queueId: 'queue-1',
      placementId: 'placement-2',
    })

    expect(result).toBe(pending)
    expect(prismaMock.announcerEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['QUEUED', 'GENERATING', 'READY', 'PLAYING'] },
          payload: {
            path: ['repeatLogicalKey'],
            equals: 'AWARD_REPEAT:placement:queue-1:placement-2',
          },
        }),
      }),
    )
  })
})
