import { describe, expect, it } from 'vitest'
import {
  buildFilterCategories,
  buildPublicResultRowKey,
  buildPublicResultRows,
  buildPublicResultsStats,
  matchesPublicResultRow,
  type PublicResultCategorySource,
  type PublicResultFilterCategorySource,
} from '../publicResults'
import { emptyBracketCategoryFilters } from '../publicCategoryFilters'

const categoryKeyA = 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66'
const categoryKeyB = 'close_control:experienced:f_juniors_1:f_juniors_1_w_le_57'

function makeSource(
  overrides: Partial<PublicResultCategorySource> & Pick<PublicResultCategorySource, 'categoryKey'>,
): PublicResultCategorySource {
  return {
    discipline: overrides.categoryKey.split(':')[0] ?? 'tactic_control',
    title: overrides.title ?? 'Категория',
    participants: overrides.participants ?? [],
    result: overrides.result ?? { status: 'complete', placements: [] },
    ...overrides,
  }
}

describe('buildPublicResultRows', () => {
  it('builds rows with resolved participant data and provisional flag from placement', () => {
    const rows = buildPublicResultRows([
      makeSource({
        categoryKey: categoryKeyA,
        title: 'Кат A',
        participants: [
          {
            entryId: 'e1',
            displayName: 'Иванов Иван',
            clubName: 'Боец',
            city: 'Екатеринбург',
          },
          {
            entryId: 'e2',
            displayName: 'Петров Пётр',
            clubName: 'Сила',
            city: 'Пермь',
          },
        ],
        result: {
          status: 'in_progress',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER', provisional: true },
          ],
        },
      }),
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      entryId: 'e1',
      displayName: 'Иванов Иван',
      clubName: 'Боец',
      placement: 1,
      provisional: false,
    })
    expect(rows[1]).toMatchObject({
      entryId: 'e2',
      placement: 2,
      provisional: true,
    })
  })

  it('does not mark guaranteed first place provisional when category is in_progress', () => {
    const rows = buildPublicResultRows([
      makeSource({
        categoryKey: categoryKeyA,
        participants: [{ entryId: 'e1', displayName: 'A', clubName: 'C', city: 'X' }],
        result: {
          status: 'in_progress',
          placements: [{ entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' }],
        },
      }),
    ])

    expect(rows[0]?.provisional).toBe(false)
  })

  it('assigns unique rowKey for two bronze placements in one category', () => {
    const rows = buildPublicResultRows([
      makeSource({
        categoryKey: categoryKeyA,
        participants: [
          { entryId: 'b1', displayName: 'Бронза Б', clubName: 'C', city: 'X' },
          { entryId: 'b2', displayName: 'Бронза А', clubName: 'C', city: 'X' },
        ],
        result: {
          status: 'complete',
          placements: [
            { entryId: 'b1', placement: 3, reason: 'BRONZE_TWO' },
            { entryId: 'b2', placement: 3, reason: 'BRONZE_TWO' },
          ],
        },
      }),
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]?.rowKey).toBe(buildPublicResultRowKey(categoryKeyA, 0, 'b1'))
    expect(rows[1]?.rowKey).toBe(buildPublicResultRowKey(categoryKeyA, 1, 'b2'))
    expect(rows[0]?.rowKey).not.toBe(rows[1]?.rowKey)
  })

  it('sorts bronze rows stably by placementIndex then displayName', () => {
    const rows = buildPublicResultRows([
      makeSource({
        categoryKey: categoryKeyA,
        participants: [
          { entryId: 'b2', displayName: 'Яковлев', clubName: 'C', city: 'X' },
          { entryId: 'b1', displayName: 'Алексеев', clubName: 'C', city: 'X' },
        ],
        result: {
          status: 'complete',
          placements: [
            { entryId: 'b2', placement: 3, reason: 'BRONZE_TWO' },
            { entryId: 'b1', placement: 3, reason: 'BRONZE_TWO' },
          ],
        },
      }),
    ])

    expect(rows.map((row) => row.displayName)).toEqual(['Яковлев', 'Алексеев'])
  })

  it('includes structural category fields for filtering', () => {
    const rows = buildPublicResultRows([
      makeSource({
        categoryKey: categoryKeyA,
        participants: [{ entryId: 'e1', displayName: 'A', clubName: 'C', city: 'X' }],
        result: {
          status: 'complete',
          placements: [{ entryId: 'e1', placement: 1, reason: 'SINGLE_PARTICIPANT' }],
        },
      }),
    ])

    expect(rows[0]?.category).toEqual({
      discipline: 'tactic_control',
      experienceLevel: 'novice',
      ageDivisionId: 'm_juniors_1',
      weightCategoryId: 'm_juniors_1_w_le_66',
      gender: 'male',
    })
  })
})

describe('buildFilterCategories', () => {
  it('includes categories without medalists', () => {
    const sources: PublicResultFilterCategorySource[] = [
      {
        categoryKey: categoryKeyA,
        discipline: 'tactic_control',
        title: 'Кат A',
        participants: [{ displayName: 'A', clubName: 'C', city: 'X' }],
      },
      {
        categoryKey: categoryKeyB,
        discipline: 'close_control',
        title: 'Кат B',
        participants: [{ displayName: 'B', clubName: 'D', city: 'Y' }],
      },
    ]

    const rows = buildPublicResultRows([
      makeSource({
        categoryKey: categoryKeyA,
        title: 'Кат A',
        participants: [{ entryId: 'e1', displayName: 'A', clubName: 'C', city: 'X' }],
        result: {
          status: 'complete',
          placements: [{ entryId: 'e1', placement: 1, reason: 'SINGLE_PARTICIPANT' }],
        },
      }),
    ])

    const filterCategories = buildFilterCategories(sources)
    expect(filterCategories).toHaveLength(2)
    expect(buildPublicResultsStats(rows).categoriesWithResults).toBe(1)
  })
})

describe('matchesPublicResultRow', () => {
  const row = buildPublicResultRows([
    makeSource({
      categoryKey: categoryKeyA,
      title: 'Тактик-контроль · Новички',
      participants: [
        {
          entryId: 'e1',
          displayName: 'Сухорослов Ярослав Артёмович',
          clubName: 'Боец',
          city: 'Екатеринбург',
        },
      ],
      result: {
        status: 'complete',
        placements: [{ entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' }],
      },
    }),
  ])[0]!

  it('matches text search with ё/е normalization', () => {
    expect(matchesPublicResultRow(row, emptyBracketCategoryFilters, 'артем')).toBe(true)
    expect(matchesPublicResultRow(row, emptyBracketCategoryFilters, 'сухорослов')).toBe(true)
  })

  it('matches structured filters via category fields', () => {
    expect(
      matchesPublicResultRow(
        row,
        {
          ...emptyBracketCategoryFilters,
          discipline: 'tactic_control',
          gender: 'male',
          experienceLevel: 'novice',
          ageDivisionId: 'm_juniors_1',
          weightCategoryId: 'm_juniors_1_w_le_66',
        },
      ),
    ).toBe(true)
    expect(
      matchesPublicResultRow(row, { ...emptyBracketCategoryFilters, gender: 'female' }),
    ).toBe(false)
  })

  it('matches club filter against medalist club, not category participants only', () => {
    expect(
      matchesPublicResultRow(row, { ...emptyBracketCategoryFilters, club: 'боец' }),
    ).toBe(true)
    expect(
      matchesPublicResultRow(row, { ...emptyBracketCategoryFilters, club: 'другой' }),
    ).toBe(false)
  })
})

describe('buildPublicResultsStats', () => {
  it('counts medalists and categories with results', () => {
    const rows = buildPublicResultRows([
      makeSource({
        categoryKey: categoryKeyA,
        participants: [
          { entryId: 'e1', displayName: 'A', clubName: 'C', city: 'X' },
          { entryId: 'e2', displayName: 'B', clubName: 'C', city: 'X' },
        ],
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
      }),
      makeSource({
        categoryKey: categoryKeyB,
        participants: [{ entryId: 'e3', displayName: 'C', clubName: 'D', city: 'Y' }],
        result: {
          status: 'complete',
          placements: [{ entryId: 'e3', placement: 1, reason: 'FINAL_WINNER' }],
        },
      }),
    ])

    expect(buildPublicResultsStats(rows)).toEqual({
      medalists: 3,
      categoriesWithResults: 2,
    })
  })
})
