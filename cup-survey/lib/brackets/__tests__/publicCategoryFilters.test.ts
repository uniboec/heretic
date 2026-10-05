import { describe, expect, it } from 'vitest'
import {
  categoryMatchesClub,
  categoryMatchesSearchQuery,
  categorySearchHaystack,
  compareBracketCategories,
  countBracketCategoriesByCompletion,
  emptyBracketCategoryFilters,
  isPublicBracketCategoryComplete,
  matchesBracketCategoryFilters,
  matchesBracketCompletionMode,
  normalizeBracketSearchText,
  participantTextMatchesQuery,
  sortBracketCategories,
} from '../publicCategoryFilters'

const sampleCategory = {
  categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
  discipline: 'tactic_control',
  title: 'Тактик-контроль · Новички · Юноши 1 · до 66 кг',
  participants: [
    {
      displayName: 'Иванов Иван',
      clubName: 'Боец',
      city: 'Екатеринбург',
    },
  ],
}

describe('matchesBracketCategoryFilters', () => {
  it('matches by participant surname in search query', () => {
    expect(matchesBracketCategoryFilters(sampleCategory, {}, 'иванов')).toBe(true)
  })

  it('matches patronymic when ё is typed as е', () => {
    const category = {
      ...sampleCategory,
      participants: [
        {
          displayName: 'Сухорослов Ярослав Артёмович',
          clubName: 'Боец',
          city: 'Екатеринбург',
        },
      ],
    }
    expect(matchesBracketCategoryFilters(category, {}, 'артем')).toBe(true)
    expect(matchesBracketCategoryFilters(category, {}, 'сухорослов')).toBe(true)
  })

  it('matches by club filter', () => {
    expect(
      matchesBracketCategoryFilters(sampleCategory, {
        ...emptyBracketCategoryFilters,
        club: 'боец',
      }),
    ).toBe(true)
    expect(
      matchesBracketCategoryFilters(sampleCategory, {
        ...emptyBracketCategoryFilters,
        club: 'другой',
      }),
    ).toBe(false)
  })

  it('matches by parsed category identity fields', () => {
    expect(
      matchesBracketCategoryFilters(sampleCategory, {
        ...emptyBracketCategoryFilters,
        discipline: 'tactic_control',
        gender: 'male',
        experienceLevel: 'novice',
        ageDivisionId: 'm_juniors_1',
        weightCategoryId: 'm_juniors_1_w_le_66',
      }),
    ).toBe(true)
    expect(
      matchesBracketCategoryFilters(sampleCategory, {
        ...emptyBracketCategoryFilters,
        gender: 'female',
      }),
    ).toBe(false)
  })
})

describe('categorySearchHaystack', () => {
  it('includes title and participant fields', () => {
    const haystack = categorySearchHaystack(sampleCategory)
    expect(haystack).toContain('иванов иван')
    expect(haystack).toContain('боец')
    expect(haystack).toContain('екатеринбург')
  })
})

describe('normalizeBracketSearchText', () => {
  it('normalizes yo letter to e', () => {
    expect(normalizeBracketSearchText(' Артём ')).toBe('артем')
  })
})

describe('participantTextMatchesQuery', () => {
  it('matches surname prefix', () => {
    expect(
      participantTextMatchesQuery(
        { displayName: 'Россошных Александр Сергеевич', clubName: '', city: '' },
        'росс',
      ),
    ).toBe(true)
  })
})

describe('categoryMatchesSearchQuery', () => {
  it('finds category by participant surname', () => {
    expect(
      categoryMatchesSearchQuery(
        {
          ...sampleCategory,
          participants: [
            {
              displayName: 'Россошных Александр Сергеевич',
              clubName: 'Боец',
              city: 'Екатеринбург',
            },
          ],
        },
        'Россошных',
      ),
    ).toBe(true)
  })
})

describe('categoryMatchesClub', () => {
  it('matches club name or city substring', () => {
    expect(categoryMatchesClub(sampleCategory, 'екат')).toBe(true)
    expect(categoryMatchesClub(sampleCategory, 'москва')).toBe(false)
  })
})

function categoryStub(
  categoryKey: string,
  title: string,
  discipline = categoryKey.split(':')[0],
) {
  return {
    categoryKey,
    discipline,
    title,
    participants: [{ displayName: 'A', clubName: 'B', city: 'C' }],
  }
}

describe('bracket completion filters', () => {
  const activeCategory = {
    ...sampleCategory,
    categoryKey: 'active',
    result: { status: 'in_progress' },
  }
  const completedCategory = {
    ...sampleCategory,
    categoryKey: 'completed',
    result: { status: 'complete' },
  }
  const noResultCategory = {
    ...sampleCategory,
    categoryKey: 'no-result',
    result: null,
  }

  it('treats only status complete as finished', () => {
    expect(isPublicBracketCategoryComplete(completedCategory)).toBe(true)
    expect(isPublicBracketCategoryComplete(activeCategory)).toBe(false)
    expect(isPublicBracketCategoryComplete(noResultCategory)).toBe(false)
  })

  it('filters categories by completion mode', () => {
    expect(matchesBracketCompletionMode(activeCategory, 'active')).toBe(true)
    expect(matchesBracketCompletionMode(activeCategory, 'completed')).toBe(false)
    expect(matchesBracketCompletionMode(activeCategory, 'all')).toBe(true)

    expect(matchesBracketCompletionMode(completedCategory, 'active')).toBe(false)
    expect(matchesBracketCompletionMode(completedCategory, 'completed')).toBe(true)
    expect(matchesBracketCompletionMode(completedCategory, 'all')).toBe(true)
  })

  it('counts active and completed categories', () => {
    expect(
      countBracketCategoriesByCompletion([activeCategory, completedCategory, noResultCategory]),
    ).toEqual({
      active: 2,
      completed: 1,
      all: 3,
    })
  })
})

describe('sortBracketCategories', () => {
  it('orders discipline → age → weight → level', () => {
    const categories = sortBracketCategories([
      categoryStub(
        'close_control:experienced:m_youths_1:m_youths_1_w_le_35',
        'Close experienced youths 35',
      ),
      categoryStub(
        'tactic_control:novice:m_boys_1:m_boys_1_w_le_16',
        'Tactic novice boys 16',
      ),
      categoryStub(
        'tactic_control:experienced:m_boys_1:m_boys_1_w_le_16',
        'Tactic experienced boys 16',
      ),
      categoryStub(
        'tactic_control:novice:m_boys_2:m_boys_2_w_le_20',
        'Tactic novice boys2 20',
      ),
      categoryStub(
        'tactic_control:novice:m_boys_1:m_boys_1_w_le_20',
        'Tactic novice boys 20',
      ),
      categoryStub(
        'tactic_control:experienced:m_boys_1:m_boys_1_w_le_20',
        'Tactic experienced boys 20',
      ),
    ])

    expect(categories.map((category) => category.categoryKey)).toEqual([
      'tactic_control:novice:m_boys_1:m_boys_1_w_le_16',
      'tactic_control:experienced:m_boys_1:m_boys_1_w_le_16',
      'tactic_control:novice:m_boys_1:m_boys_1_w_le_20',
      'tactic_control:experienced:m_boys_1:m_boys_1_w_le_20',
      'tactic_control:novice:m_boys_2:m_boys_2_w_le_20',
      'close_control:experienced:m_youths_1:m_youths_1_w_le_35',
    ])
  })

  it('treats legacy beginner level as novice for ordering within weight', () => {
    expect(
      compareBracketCategories(
        categoryStub('tactic_control:beginner:m_boys_1:m_boys_1_w_le_16', 'Legacy novice'),
        categoryStub('tactic_control:experienced:m_boys_1:m_boys_1_w_le_16', 'Experienced'),
      ),
    ).toBeLessThan(0)
  })
})
