import { describe, expect, it } from 'vitest'
import { toAdminAwardsDto } from '../dto/admin'
import type { AwardsPageSettings, QueueWithPlacements } from '../types'

function queueItem(input: {
  id: string
  queueOrder: number
  status: QueueWithPlacements['status']
}): QueueWithPlacements {
  return {
    id: input.id,
    tournamentScopeId: 'cup-2026',
    categoryKey: input.id,
    status: input.status,
    queueGroup: 'NORMAL',
    queueOrder: input.queueOrder,
    needsReview: false,
    conflictReason: null,
    revision: 1,
    ceremonySequence: null,
    durationMinutesSnapshot: null,
    breakMinutesSnapshot: null,
    scheduledStartAtSnapshot: null,
    actualStartAt: null,
    actualEndAt: null,
    adminComment: null,
    publicComment: null,
    placements: [],
  }
}

const settings: AwardsPageSettings = {
  publicEnabled: false,
  ceremonyStartTime: '18:00',
  ceremonyDurationMinutes: 5,
  ceremonyBreakMinutes: 2,
  ceremonySequenceCounter: 1,
  queueRevision: 1,
}

describe('toAdminAwardsDto', () => {
  it('keeps active categories in queueOrder after status changes', () => {
    const dto = toAdminAwardsDto({
      settings,
      queue: [
        queueItem({ id: 'cat-a', queueOrder: 1, status: 'PENDING' }),
        queueItem({ id: 'cat-b', queueOrder: 2, status: 'IN_PROGRESS' }),
        queueItem({ id: 'cat-c', queueOrder: 3, status: 'PENDING' }),
      ],
      scheduled: [],
      remainingMedals: { summary: { gold: 0, silver: 0, bronze: 0 }, items: [] },
    })

    expect(dto.queue.map((item) => item.queueId)).toEqual(['cat-a', 'cat-b', 'cat-c'])
  })
})
