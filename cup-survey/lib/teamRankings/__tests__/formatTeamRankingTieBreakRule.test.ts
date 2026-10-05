import { describe, expect, it } from 'vitest'
import { formatTeamRankingTieBreakRule } from '../formatTeamRankingTieBreakRule'

describe('formatTeamRankingTieBreakRule', () => {
  it('describes tie-break order and shared ranks', () => {
    expect(formatTeamRankingTieBreakRule()).toContain('1-х мест')
    expect(formatTeamRankingTieBreakRule()).toContain('делят место')
  })
})
