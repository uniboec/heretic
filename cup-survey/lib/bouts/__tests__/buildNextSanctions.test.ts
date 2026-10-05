import { describe, expect, it } from 'vitest'
import { buildNextSanctions } from '../buildNextSanctions'
import type { ScoreState } from '../mat-control/types'

function emptyScore(): ScoreState {
  return {
    officialScore: { red: 0, blue: 0 },
    technicalScore: { red: 0, blue: 0 },
    periodPenaltyCount: { red: 0, blue: 0 },
    generalDisciplinaryLadder: { red: null, blue: null },
    outOfBoundsLadder: { red: null, blue: null },
    passivityLadder: { red: null, blue: null },
    technicalCounts: {
      red: { 1: 0, 2: 0, 3: 0, 4: 0 },
      blue: { 1: 0, 2: 0, 3: 0, 4: 0 },
    },
  }
}

describe('buildNextSanctions', () => {
  it('predicts first step as WARNING_1', () => {
    const next = buildNextSanctions(emptyScore())
    expect(next.red.general).toBe('WARNING_1')
    expect(next.blue.outOfBounds).toBe('WARNING_1')
  })

  it('predicts DISQUALIFICATION after WARNING_3', () => {
    const score = emptyScore()
    score.generalDisciplinaryLadder.red = 'WARNING_3'
    const next = buildNextSanctions(score)
    expect(next.red.general).toBe('DISQUALIFICATION')
  })
})
