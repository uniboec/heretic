import { describe, expect, it } from 'vitest'
import { emptyBracketCategoryFilters } from '@/lib/brackets/publicCategoryFilters'
import {
  buildAwardsFilterCategories,
  filterAwardCategories,
} from '../publicAwardsFilters'

const sampleResponse = {
  published: true,
  ceremonyStartTime: '11:00',
  generatedAt: '2026-10-03T06:00:00.000Z',
  queue: [
    {
      queueId: 'q1',
      categoryKey: 'tactic_control:experienced:m_youths_2:m_youths_2_w_le_38',
      categoryTitle: 'Тактик Контрол · Опытные · 12–13 лет · до 38 кг',
      status: 'PENDING' as const,
      estimatedTimeLabel: '11:00',
      publicComment: null,
      placements: [
        {
          id: 'p1',
          entryId: 'e1',
          placement: 1,
          placementIndex: 0,
          displayName: 'Самиев Виктор',
          clubName: 'Клуб А',
          status: 'PENDING' as const,
          publicComment: null,
        },
      ],
    },
  ],
  completed: [
    {
      queueId: 'q2',
      categoryKey: 'close_control:experienced:m_youths_1:m_youths_1_w_le_35',
      categoryTitle: 'Клоус Контрол · Опытные · 10–11 лет · до 35 кг',
      completedAt: '2026-10-03T06:10:00.000Z',
      completedAtLabel: '14:32',
      ceremonySequence: 1,
      publicComment: null,
      placements: [
        {
          id: 'p2',
          entryId: 'e2',
          placement: 1,
          placementIndex: 0,
          displayName: 'Потапов Георгий',
          clubName: 'Клуб Б',
          status: 'AWARDED' as const,
          publicComment: null,
        },
      ],
    },
  ],
}

describe('publicAwardsFilters', () => {
  it('builds filter categories from queue and completed', () => {
    const categories = buildAwardsFilterCategories(sampleResponse)
    expect(categories).toHaveLength(2)
  })

  it('filters queue by athlete name', () => {
    const filtered = filterAwardCategories(sampleResponse.queue, emptyBracketCategoryFilters, 'Самиев')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.placements[0]?.displayName).toBe('Самиев Виктор')
  })

  it('filters by discipline', () => {
    const filtered = filterAwardCategories(sampleResponse.queue, {
      ...emptyBracketCategoryFilters,
      discipline: 'close_control',
    })
    expect(filtered).toHaveLength(0)
  })
})
