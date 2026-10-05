import { describe, expect, it } from 'vitest'
import { buildRemainingMedals } from '../remainingMedals'

describe('buildRemainingMedals', () => {
  it('aggregates not awarded medals by placement', () => {
    const result = buildRemainingMedals([
      {
        id: 'q1',
        tournamentScopeId: 'cup-2026',
        categoryKey: 'cat-a',
        status: 'COMPLETED',
        needsReview: false,
        queueGroup: 'NORMAL',
        queueOrder: 0,
        ceremonySequence: 1,
        completedAtCategory: new Date(),
        ceremonyCompletedAt: new Date(),
        actualStartAt: new Date(),
        actualEndAt: new Date(),
        scheduledStartAtSnapshot: null,
        durationMinutesSnapshot: 3,
        breakMinutesSnapshot: 0,
        adminComment: null,
        publicComment: null,
        conflictReason: null,
        revision: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        placements: [
          {
            id: 'p1',
            queueId: 'q1',
            entryId: 'e1',
            placement: 3,
            placementIndex: 0,
            status: 'NOT_AWARDED',
            resolvedAt: new Date('2026-10-03T09:32:00.000Z'),
            adminComment: 'уехал домой',
            publicComment: null,
            lastName: 'Иванов',
            firstName: 'Иван',
            middleName: null,
            clubName: 'Клуб',
          },
        ],
      },
    ])

    expect(result.summary.bronze).toBe(1)
    expect(result.items[0]?.displayName).toContain('Иванов')
    expect(result.items[0]?.comment).toBe('уехал домой')
  })
})
