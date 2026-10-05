import { describe, expect, it } from 'vitest'
import { formatTeamScoringRule } from '../formatTeamScoringRule'

describe('formatTeamScoringRule', () => {
  it('formats standard scoring rule', () => {
    expect(
      formatTeamScoringRule({
        first: 5,
        second: 3,
        third: 2,
        soloParticipant: { mode: 'STANDARD', points: null },
      }),
    ).toBe('1 место — 5, 2 место — 3, 3 место — 2 балла.')
  })

  it('formats exclude scoring rule', () => {
    expect(
      formatTeamScoringRule({
        first: 5,
        second: 3,
        third: 2,
        soloParticipant: { mode: 'EXCLUDE', points: null },
      }),
    ).toContain('не дают командных баллов')
  })
})
