import { describe, expect, it } from 'vitest'

import {
  awardedPointsForSanction,
  nextSanctionOnLadder,
} from '../fseRules'

describe('fseRules penalty ladder', () => {
  it('starts with first warning and awards escalating points', () => {
    expect(nextSanctionOnLadder('GENERAL', null)).toBe('WARNING_1')
    expect(awardedPointsForSanction('WARNING_1')).toBe(1)
    expect(awardedPointsForSanction('WARNING_2')).toBe(2)
    expect(awardedPointsForSanction('WARNING_3')).toBe(3)
    expect(awardedPointsForSanction('DISQUALIFICATION')).toBe(0)
  })

  it('progresses through three warnings before disqualification', () => {
    expect(nextSanctionOnLadder('GENERAL', 'WARNING_1')).toBe('WARNING_2')
    expect(nextSanctionOnLadder('GENERAL', 'WARNING_2')).toBe('WARNING_3')
    expect(nextSanctionOnLadder('GENERAL', 'WARNING_3')).toBe('DISQUALIFICATION')
  })

  it('treats legacy remark as before first warning', () => {
    expect(nextSanctionOnLadder('OUT_OF_BOUNDS', 'REMARK')).toBe('WARNING_1')
  })
})
