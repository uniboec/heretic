import { describe, expect, it } from 'vitest'
import { compareNormQualificationRows, filterNormQualificationRows } from '../sortAndFilter'
import type { NormQualificationsPublicRow } from '../types'

function row(
  partial: Partial<NormQualificationsPublicRow> & Pick<NormQualificationsPublicRow, 'achievedNormRank'>,
): NormQualificationsPublicRow {
  return {
    athleteId: 'a1',
    athleteName: 'Иванов Иван',
    clubName: 'Боец',
    city: 'Екатеринбург',
    discipline: 'close_control',
    disciplineLabel: 'Клоус',
    resultLabel: 'III взрослого разряда',
    categoryLabel: 'Опытные · 16–17 лет · до 48 кг',
    placement: 1,
    wins: 1,
    matchingBrackets: [],
    ...partial,
  }
}

describe('sortAndFilter', () => {
  it('sorts adult ranks above youth and child', () => {
    const rows = [
      row({ athleteId: 'c', athleteName: 'Третий', achievedNormRank: 'child_3' }),
      row({ athleteId: 'a', athleteName: 'Первый', achievedNormRank: 'adult_1' }),
      row({ athleteId: 'y', athleteName: 'Второй', achievedNormRank: 'youth_2' }),
    ]

    const sorted = filterNormQualificationRows({
      rows,
      discipline: 'all',
      rank: 'all',
      search: '',
    })

    expect(sorted.map((item) => item.achievedNormRank)).toEqual(['adult_1', 'youth_2', 'child_3'])
  })

  it('filters by discipline, rank and search', () => {
    const rows = [
      row({
        athleteId: '1',
        athleteName: 'Иванов Иван',
        clubName: 'Боец',
        discipline: 'close_control',
        achievedNormRank: 'adult_2',
      }),
      row({
        athleteId: '2',
        athleteName: 'Петров Пётр',
        clubName: 'Титан',
        city: 'Первоуральск',
        discipline: 'tactic_control',
        disciplineLabel: 'Тактик',
        achievedNormRank: 'youth_3',
      }),
    ]

    expect(
      filterNormQualificationRows({
        rows,
        discipline: 'tactic_control',
        rank: 'all',
        search: '',
      }),
    ).toHaveLength(1)

    expect(
      filterNormQualificationRows({
        rows,
        discipline: 'all',
        rank: 'adult_2',
        search: '',
      }),
    ).toHaveLength(1)

    expect(
      filterNormQualificationRows({
        rows,
        discipline: 'all',
        rank: 'all',
        search: 'титан',
      }),
    ).toHaveLength(1)

    expect(compareNormQualificationRows(rows[0], rows[1])).toBeLessThan(0)
  })
})
