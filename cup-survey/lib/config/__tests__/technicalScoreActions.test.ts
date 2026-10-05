import { describe, expect, it } from 'vitest'
import {
  getTechnicalScoreAction,
  TECHNICAL_SCORE_ACTIONS_BY_POINTS,
} from '../technicalScoreActions'

describe('technicalScoreActions', () => {
  it('groups actions under score columns', () => {
    expect(TECHNICAL_SCORE_ACTIONS_BY_POINTS[1].map((action) => action.id)).toEqual([
      'SPRAWL_CONTROL',
      'GUARD_CONTROL',
      'THROW_TRANSFER_NO_LIFT',
    ])
    expect(TECHNICAL_SCORE_ACTIONS_BY_POINTS[2].map((action) => action.id)).toEqual([
      'REVERSAL_CONTROL',
      'THROW_TWO_FEET_LIFT',
    ])
    expect(TECHNICAL_SCORE_ACTIONS_BY_POINTS[3].map((action) => action.id)).toEqual([
      'SIDE_CONTROL',
      'THROW_AMPLITUDE_CHEST',
    ])
    expect(TECHNICAL_SCORE_ACTIONS_BY_POINTS[4].map((action) => action.id)).toEqual([
      'FULL_CONTROL',
      'BACK_CONTROL',
    ])
  })

  it('resolves action metadata', () => {
    expect(getTechnicalScoreAction('GUARD_CONTROL')).toMatchObject({
      shortLabel: 'Grd',
      points: 1,
      label: 'Гард',
    })
    expect(getTechnicalScoreAction('BACK_CONTROL')).toMatchObject({
      shortLabel: 'Back',
      points: 4,
    })
  })
})
