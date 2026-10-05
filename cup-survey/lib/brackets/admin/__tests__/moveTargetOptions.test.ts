import { describe, expect, it } from 'vitest'
import {
  buildAgeDivisionOptionsWithCounts,
  buildDisciplineOptionsWithCounts,
  buildExperienceLevelOptionsWithCounts,
  buildWeightOptionsWithCounts,
  countParticipantsInMoveTargetSnapshot,
  emptyMoveTargetSelection,
  getMoveTargetSummary,
  isMoveTargetReady,
  patchMoveTargetSelection,
  resolveMoveTargetCategoryKey,
} from '../moveTargetOptions'
import { validateTargetCategoryStructure } from '../../../registration/categoryRules'

const ALL_KEYS = [
  { key: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66', title: 'A', participantCount: 2 },
  { key: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_71', title: 'B', participantCount: 1 },
  { key: 'tactic_control:beginner:m_juniors_1:w_66', title: 'Legacy', participantCount: 3 },
  { key: 'close_control:experienced:m_juniors_2:m_juniors_2_w_le_77', title: 'C', participantCount: 4 },
]

describe('validateTargetCategoryStructure', () => {
  it('accepts a valid male category key', () => {
    expect(
      validateTargetCategoryStructure('tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66', 'male'),
    ).toBeNull()
  })

  it('accepts beginner alias for experience level', () => {
    expect(
      validateTargetCategoryStructure('tactic_control:beginner:m_juniors_1:w_66', 'male'),
    ).toBeNull()
  })

  it('accepts legacy short weight ids', () => {
    expect(
      validateTargetCategoryStructure('tactic_control:novice:m_juniors_1:w_71', 'male'),
    ).toBeNull()
  })

  it('rejects malformed key', () => {
    expect(validateTargetCategoryStructure('bad-key', 'male')).toEqual({
      code: 'INVALID_TARGET_CATEGORY',
      message: 'Некорректный ключ категории',
    })
  })

  it('rejects unknown discipline', () => {
    expect(
      validateTargetCategoryStructure('unknown:novice:m_juniors_1:w_66', 'male'),
    ).toEqual({
      code: 'INVALID_TARGET_CATEGORY',
      message: 'Дисциплина не найдена в турнире',
    })
  })

  it('rejects invalid weight for age division', () => {
    expect(
      validateTargetCategoryStructure('tactic_control:novice:m_juniors_1:w_999', 'male'),
    ).toEqual({
      code: 'INVALID_TARGET_CATEGORY',
      message: 'Весовая категория не подходит для возрастной группы',
    })
  })

  it('rejects female category for male athlete', () => {
    expect(
      validateTargetCategoryStructure('tactic_control:novice:f_juniors_1:w_44', 'male'),
    ).toEqual({
      code: 'GENDER_MISMATCH',
      message: 'Целевая категория не соответствует полу спортсмена',
    })
  })
})

describe('moveTargetOptions', () => {
  it('resets dependent fields on cascade patch', () => {
    const initial = {
      discipline: 'tactic_control',
      experienceLevel: 'novice',
      ageDivisionId: 'm_juniors_1',
      weightCategoryId: 'm_juniors_1_w_le_66',
    }
    expect(patchMoveTargetSelection(initial, 'discipline', 'close_control')).toEqual({
      discipline: 'close_control',
      experienceLevel: '',
      ageDivisionId: '',
      weightCategoryId: '',
    })
    expect(patchMoveTargetSelection(initial, 'ageDivisionId', 'm_juniors_2')).toEqual({
      ...initial,
      ageDivisionId: 'm_juniors_2',
      weightCategoryId: '',
    })
  })

  it('builds category key only when selection is complete', () => {
    expect(
      resolveMoveTargetCategoryKey(emptyMoveTargetSelection(), 'male'),
    ).toBeNull()
    expect(
      resolveMoveTargetCategoryKey(
        {
          discipline: 'tactic_control',
          experienceLevel: 'novice',
          ageDivisionId: 'm_juniors_1',
          weightCategoryId: 'm_juniors_1_w_le_66',
        },
        'male',
      ),
    ).toBe('tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66')
  })

  it('includes snapshot counts in weight options', () => {
    const options = buildWeightOptionsWithCounts(
      {
        discipline: 'tactic_control',
        experienceLevel: 'novice',
        ageDivisionId: 'm_juniors_1',
        weightCategoryId: '',
      },
      'male',
      ALL_KEYS,
    )
    expect(options.find((option) => option.weightCategoryId === 'm_juniors_1_w_le_66')?.count).toBe(5)
    expect(options.find((option) => option.weightCategoryId === 'm_juniors_1_w_le_71')?.count).toBe(1)
  })

  it('aggregates counts for discipline, level and age options', () => {
    expect(buildDisciplineOptionsWithCounts('male', ALL_KEYS)).toEqual([
      { id: 'tactic_control', label: 'Tactic-Control', count: 6 },
      { id: 'close_control', label: 'Close-Control', count: 4 },
    ])

    expect(
      buildExperienceLevelOptionsWithCounts(
        { discipline: 'tactic_control', experienceLevel: '', ageDivisionId: '', weightCategoryId: '' },
        'male',
        ALL_KEYS,
      ),
    ).toEqual([
      { id: 'novice', label: 'Новички', count: 6 },
      { id: 'experienced', label: 'Опытные', count: 0 },
    ])

    expect(
      buildAgeDivisionOptionsWithCounts(
        {
          discipline: 'tactic_control',
          experienceLevel: 'novice',
          ageDivisionId: '',
          weightCategoryId: '',
        },
        'male',
        ALL_KEYS,
      ).find((option) => option.id === 'm_juniors_1')?.count,
    ).toBe(6)
  })

  it('merges legacy and canonical keys for the same weight category', () => {
    expect(
      countParticipantsInMoveTargetSnapshot(ALL_KEYS, 'male', {
        discipline: 'tactic_control',
        experienceLevel: 'novice',
        ageDivisionId: 'm_juniors_1',
        weightCategoryId: 'm_juniors_1_w_le_66',
      }),
    ).toBe(5)
  })

  it('builds summary for empty and populated categories', () => {
    const emptySummary = getMoveTargetSummary(
      {
        discipline: 'tactic_control',
        experienceLevel: 'novice',
        ageDivisionId: 'm_juniors_1',
        weightCategoryId: 'm_juniors_1_w_le_71',
      },
      'male',
      ALL_KEYS,
      'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
    )
    expect(emptySummary).toEqual({
      currentCount: 1,
      afterCount: 2,
      willCreateCategory: false,
    })

    const populatedSummary = getMoveTargetSummary(
      {
        discipline: 'tactic_control',
        experienceLevel: 'novice',
        ageDivisionId: 'm_juniors_1',
        weightCategoryId: 'm_juniors_1_w_le_66',
      },
      'male',
      ALL_KEYS,
      'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_71',
    )
    expect(populatedSummary).toEqual({
      currentCount: 5,
      afterCount: 6,
      willCreateCategory: false,
    })
  })

  it('blocks move into current category', () => {
    const selection = {
      discipline: 'tactic_control',
      experienceLevel: 'novice',
      ageDivisionId: 'm_juniors_1',
      weightCategoryId: 'm_juniors_1_w_le_66',
    }
    expect(
      isMoveTargetReady(selection, 'male', 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66'),
    ).toBe(false)
    expect(
      isMoveTargetReady(selection, 'male', 'tactic_control:novice:m_juniors_1:w_71'),
    ).toBe(true)
  })
})
