import { describe, expect, it } from 'vitest'
import { isScheduleFreezeIntent, shouldFreezeBeforeMatControl } from '../scheduleFreezeIntent'

describe('scheduleFreezeIntent', () => {
  it('treats mat-control disqualify intents as freeze operations', () => {
    expect(isScheduleFreezeIntent('PENALTY_DISQUALIFY')).toBe(true)
    expect(isScheduleFreezeIntent('ATHLETE_EQUIPMENT_DISQUALIFY')).toBe(true)
    expect(isScheduleFreezeIntent('STOPPAGE_FORFEIT')).toBe(true)
    expect(isScheduleFreezeIntent('NO_SHOW')).toBe(true)
  })

  it('treats scheduled stoppage completions as freeze operations', () => {
    expect(isScheduleFreezeIntent('STOPPAGE_INJURY')).toBe(true)
    expect(isScheduleFreezeIntent('STOPPAGE_SUBMISSION')).toBe(true)
    expect(isScheduleFreezeIntent('STOPPAGE_CHOKE')).toBe(true)
    expect(isScheduleFreezeIntent('STOPPAGE_CLEAR_ADVANTAGE')).toBe(true)
  })

  it('does not treat unrelated intents as freeze operations', () => {
    expect(isScheduleFreezeIntent('TECHNICAL_SCORE')).toBe(false)
    expect(isScheduleFreezeIntent('CLOCK_STOP')).toBe(false)
  })

  it('skips freeze before mat control when number is already frozen', () => {
    expect(
      shouldFreezeBeforeMatControl({
        intent: 'PENALTY_DISQUALIFY',
        actualStartAt: null,
        frozenScheduleFormatted: '1-2',
      }),
    ).toBe(false)
  })

  it('requires freeze before scheduled disqualify', () => {
    expect(
      shouldFreezeBeforeMatControl({
        intent: 'PENALTY_DISQUALIFY',
        actualStartAt: null,
        frozenScheduleFormatted: null,
      }),
    ).toBe(true)
  })
})
