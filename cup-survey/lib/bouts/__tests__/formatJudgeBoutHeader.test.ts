import { describe, expect, it } from 'vitest'
import {
  formatJudgeBoutCategoryLine,
  formatJudgeBoutHeader,
  formatJudgeBoutStageLabel,
  isRedundantJudgeBoutStageLabel,
  shouldShowJudgeBoutStageLabel,
} from '../formatJudgeBoutHeader'

describe('formatJudgeBoutHeader', () => {
  it('does not duplicate discipline in the category line', () => {
    expect(
      formatJudgeBoutCategoryLine(
        'Клоус Контрол · Опытные · 12–13 лет · до 38 кг',
        'Клоус Контрол',
      ),
    ).toBe('Клоус Контрол · Опытные · 12–13 лет · до 38 кг')
  })

  it('builds a readable header for an elimination bout', () => {
    expect(
      formatJudgeBoutHeader({
        categoryTitle: 'Клоус Контрол · Опытные · 12–13 лет · до 38 кг',
        discipline: 'Клоус Контрол',
        schedulePhase: 'elimination',
        round: 2,
        roundsUntilFinal: 2,
        scheduleDisplayNumber: '1-3',
      }),
    ).toEqual({
      matchTitle: 'Бой №1-3',
      stageLabel: '1/4 финала',
      categoryLine: 'Клоус Контрол · Опытные · 12–13 лет · до 38 кг',
    })
  })

  it('uses explicit bout label when present', () => {
    expect(
      formatJudgeBoutStageLabel({
        schedulePhase: 'bronze',
        boutLabel: 'Бронза A',
        round: 3,
      }),
    ).toBe('Бронза A')
  })

  it('hides stage label when it duplicates match number', () => {
    expect(isRedundantJudgeBoutStageLabel('Бой 1-1', '1-1')).toBe(true)
    expect(isRedundantJudgeBoutStageLabel('Бой №1-1', '1-1')).toBe(true)
    expect(shouldShowJudgeBoutStageLabel('1/4 финала', '1-3')).toBe(true)
    expect(shouldShowJudgeBoutStageLabel('Бой 1-1', '1-1')).toBe(false)
  })
})
