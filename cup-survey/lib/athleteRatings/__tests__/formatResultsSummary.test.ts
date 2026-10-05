import { describe, expect, it } from 'vitest'
import {
  formatPlacementSummaryForView,
  formatResultsSummaryForView,
} from '../formatResultsSummary'
import type { AthleteRatingDisciplineResult } from '../types'

function disciplineResult(
  placements: number[],
  discipline: 'tactic_control' | 'close_control' = 'tactic_control',
): AthleteRatingDisciplineResult {
  return {
    discipline,
    placements,
    countableWins: 0,
    pointsWins: 0,
    submissionChokeWins: 0,
    injuryWins: 0,
    dqWins: 0,
    forfeitWins: 0,
    ratingHundredths: 0,
    tieBreak: {
      countableWins: 0,
      submissionChokeWins: 0,
      firstPlaces: 0,
      secondPlaces: 0,
      thirdPlaces: 0,
      bestSingleDisciplineHundredths: 0,
    },
    breakdown: {
      discipline,
      disciplineLabel: 'Tactic-Control',
      lines: [],
      rawHundredths: 0,
      ageBracketKey: '14-15',
      ageBracketLabel: '14–15',
      ageCoeffPercent: 100,
      ratingHundredths: 0,
    },
  }
}

describe('formatPlacementSummaryForView', () => {
  const tc = disciplineResult([1])
  const cc = disciplineResult([2], 'close_control')

  it('uses abbreviated discipline labels in overall view', () => {
    expect(formatPlacementSummaryForView('overall', tc, cc)).toBe('TC: 1 · CC: 2')
  })

  it('uses abbreviated discipline labels in discipline views', () => {
    expect(formatPlacementSummaryForView('tactic_control', tc, null)).toBe('TC: 1')
    expect(formatPlacementSummaryForView('close_control', null, cc)).toBe('CC: 2')
  })

  it('lists all placements in one discipline', () => {
    const multi = disciplineResult([1, 3])
    expect(formatPlacementSummaryForView('tactic_control', multi, null)).toBe('TC: 1, 3')
  })
})

describe('formatResultsSummaryForView', () => {
  it('lists all medals earned in one discipline', () => {
    const multi = disciplineResult([1, 3])
    expect(formatResultsSummaryForView('tactic_control', multi, null)).toBe('🥇 TC · 🥉 TC')
  })

  it('lists medals from both disciplines in overall view', () => {
    const tc = disciplineResult([1, 2])
    const cc = disciplineResult([3], 'close_control')
    expect(formatResultsSummaryForView('overall', tc, cc)).toBe('🥇 TC · 🥈 TC · 🥉 CC')
  })
})
