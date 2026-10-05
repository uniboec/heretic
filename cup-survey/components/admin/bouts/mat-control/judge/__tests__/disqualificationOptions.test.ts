import { describe, expect, it } from 'vitest'

import {
  DISQUALIFICATION_REASONS,
  disqualificationReasonLabel,
  getDisqualifiableCorners,
} from '../disqualificationOptions'

describe('disqualificationOptions', () => {
  it('lists all disqualification reasons', () => {
    expect(DISQUALIFICATION_REASONS.map((reason) => reason.ladder)).toEqual([
      'GENERAL',
      'OUT_OF_BOUNDS',
      'PASSIVITY',
    ])
  })

  it('returns both corners when both athletes are present', () => {
    expect(
      getDisqualifiableCorners({ redEntryId: 'red-1', blueEntryId: 'blue-1' }),
    ).toEqual(['red', 'blue'])
  })

  it('skips corners without participants', () => {
    expect(getDisqualifiableCorners({ redEntryId: 'red-1', blueEntryId: null })).toEqual(['red'])
  })

  it('resolves reason labels', () => {
    expect(disqualificationReasonLabel('PASSIVITY')).toBe('За пассивность')
  })
})
