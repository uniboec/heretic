import { describe, expect, it } from 'vitest'
import {
  formatCornerAuxTimerLabel,
  formatJudgeClock,
  formatJudgeElapsedClock,
  formatJudgeLimitTimer,
} from '../judgeUtils'

describe('formatJudgeLimitTimer', () => {
  it('shows elapsed/limit ratio under the cap', () => {
    expect(formatJudgeLimitTimer(105_000, 120_000)).toEqual({
      elapsed: '01:45',
      limit: '02:00',
      ratio: '01:45/02:00',
      overtime: null,
      overLimit: false,
    })
  })

  it('shows overtime once the cap is exceeded', () => {
    expect(formatJudgeLimitTimer(128_000, 120_000)).toEqual({
      elapsed: '02:08',
      limit: '02:00',
      ratio: '02:08/02:00',
      overtime: '+00:08',
      overLimit: true,
    })
  })

  it('marks exact limit as over-limit with zero overtime', () => {
    expect(formatJudgeLimitTimer(120_000, 120_000)).toEqual({
      elapsed: '02:00',
      limit: '02:00',
      ratio: '02:00/02:00',
      overtime: '+00:00',
      overLimit: true,
    })
  })

  it('keeps overtime at +00:00 for the first second after the limit', () => {
    expect(formatJudgeLimitTimer(120_500, 120_000)).toEqual({
      elapsed: '02:00',
      limit: '02:00',
      ratio: '02:00/02:00',
      overtime: '+00:00',
      overLimit: true,
    })
  })
})

describe('formatCornerAuxTimerLabel', () => {
  it('prefixes active timers with a dot', () => {
    expect(formatCornerAuxTimerLabel('Врач', 90_000, 120_000, true)).toBe('● Врач 01:30/02:00')
  })

  it('includes overtime in the label', () => {
    expect(formatCornerAuxTimerLabel('Экипировка', 135_000, 120_000, false)).toBe(
      'Экипировка 02:15/02:00 +00:15',
    )
  })
})

describe('formatJudgeClock', () => {
  it('formats mm:ss', () => {
    expect(formatJudgeClock(65_000)).toBe('01:05')
  })

  it('rounds countdown timers up', () => {
    expect(formatJudgeClock(1_001)).toBe('00:02')
  })
})

describe('formatJudgeElapsedClock', () => {
  it('formats mm:ss', () => {
    expect(formatJudgeElapsedClock(65_000)).toBe('01:05')
  })

  it('rounds elapsed timers down', () => {
    expect(formatJudgeElapsedClock(20_999)).toBe('00:20')
    expect(formatJudgeElapsedClock(21_000)).toBe('00:21')
  })
})
