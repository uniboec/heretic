import { describe, expect, it } from 'vitest'
import { toPublicAwardDto } from '../dto/public'

describe('toPublicAwardDto', () => {
  it('excludes admin fields and splits queue vs completed', () => {
    const dto = toPublicAwardDto({
      ceremonyStartTime: '11:00',
      generatedAt: new Date('2026-10-03T06:00:00.000Z'),
      categoryComments: new Map([['q1', 'публичный коммент']]),
      placementComments: new Map([['p1', 'публичный спортсмен']]),
      completedTimestamps: new Map([
        ['q2', new Date('2026-10-03T06:10:00.000Z')],
      ]),
      ceremonySequences: new Map([['q1', 1], ['q2', 2]]),
      scheduled: [
        {
          queueId: 'q1',
          categoryKey: 'cat-a',
          status: 'IN_PROGRESS',
          queueGroup: 'NORMAL',
          queueOrder: 0,
          ceremonySequence: 1,
          placements: [
            {
              id: 'p1',
              queueId: 'q1',
              entryId: 'e1',
              placement: 1,
              placementIndex: 0,
              status: 'PENDING',
              resolvedAt: null,
              adminComment: 'secret',
              publicComment: null,
              lastName: 'Иванов',
              firstName: 'Иван',
              middleName: null,
              clubName: 'Клуб',
            },
          ],
          timing: {
            scheduledStartAt: '2026-10-03T06:00:00.000Z',
            estimatedStartAt: '2026-10-03T06:00:00.000Z',
            estimatedEndAt: '2026-10-03T06:03:00.000Z',
            delayMinutes: 0,
            durationMinutes: 3,
          },
        },
        {
          queueId: 'q2',
          categoryKey: 'cat-b',
          status: 'COMPLETED',
          queueGroup: 'NORMAL',
          queueOrder: 1,
          ceremonySequence: 2,
          placements: [
            {
              id: 'p2',
              queueId: 'q2',
              entryId: 'e2',
              placement: 1,
              placementIndex: 0,
              status: 'AWARDED',
              resolvedAt: new Date('2026-10-03T06:10:00.000Z'),
              adminComment: 'admin-secret',
              publicComment: null,
              lastName: 'Петров',
              firstName: 'Пётр',
              middleName: null,
              clubName: 'Клуб 2',
            },
          ],
          timing: {
            scheduledStartAt: '2026-10-03T06:03:00.000Z',
            estimatedStartAt: '2026-10-03T06:03:00.000Z',
            estimatedEndAt: '2026-10-03T06:06:00.000Z',
            delayMinutes: 0,
            durationMinutes: 3,
            actualEndAt: '2026-10-03T06:10:00.000Z',
          },
        },
      ],
    })

    expect(dto.queue).toHaveLength(1)
    expect(dto.completed).toHaveLength(1)
    expect(dto.queue[0]?.publicComment).toBe('публичный коммент')
    expect(dto.queue[0]?.placements[0]?.publicComment).toBe('публичный спортсмен')
    expect(dto.queue[0]?.placements[0]).not.toHaveProperty('adminComment')
    expect(dto.completed[0]?.completedAtLabel).toBeTruthy()
    expect(dto.completed[0]?.placements[0]).not.toHaveProperty('adminComment')
    expect(JSON.stringify(dto)).not.toContain('adminComment')
    expect(JSON.stringify(dto)).not.toContain('admin-secret')
    expect(JSON.stringify(dto)).not.toContain('secret')
  })

  it('sorts completed by ceremonyCompletedAt DESC with tie-breaker', () => {
    const dto = toPublicAwardDto({
      ceremonyStartTime: '11:00',
      generatedAt: new Date('2026-10-03T07:00:00.000Z'),
      categoryComments: new Map(),
      placementComments: new Map(),
      completedTimestamps: new Map([
        ['q-old', new Date('2026-10-03T06:00:00.000Z')],
        ['q-new', new Date('2026-10-03T06:30:00.000Z')],
      ]),
      ceremonySequences: new Map([['q-old', 1], ['q-new', 2]]),
      scheduled: [
        {
          queueId: 'q-old',
          categoryKey: 'cat-old',
          status: 'COMPLETED',
          queueGroup: 'NORMAL',
          queueOrder: 0,
          ceremonySequence: 1,
          placements: [],
          timing: {
            scheduledStartAt: '2026-10-03T06:00:00.000Z',
            estimatedStartAt: '2026-10-03T06:00:00.000Z',
            estimatedEndAt: '2026-10-03T06:03:00.000Z',
            delayMinutes: 0,
            durationMinutes: 3,
          },
        },
        {
          queueId: 'q-new',
          categoryKey: 'cat-new',
          status: 'COMPLETED',
          queueGroup: 'NORMAL',
          queueOrder: 1,
          ceremonySequence: 2,
          placements: [],
          timing: {
            scheduledStartAt: '2026-10-03T06:03:00.000Z',
            estimatedStartAt: '2026-10-03T06:03:00.000Z',
            estimatedEndAt: '2026-10-03T06:06:00.000Z',
            delayMinutes: 0,
            durationMinutes: 3,
          },
        },
      ],
    })

    expect(dto.completed.map((item) => item.queueId)).toEqual(['q-new', 'q-old'])
  })
})
