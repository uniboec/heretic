import { describe, expect, it } from 'vitest'
import { BOUT_REPEAT_INTERVAL_MS } from '../hooks/repeatCall'
import { BOUT_REPEAT_CALL_PRIORITY, DEFAULT_PRIORITIES } from '../types'

function repeatBucket(nowMs: number, episodeStartMs: number): number {
  return Math.floor((nowMs - episodeStartMs) / BOUT_REPEAT_INTERVAL_MS)
}

describe('announcer playback priorities', () => {
  it('plays bout result before repeat, call, and prepare after confirm', () => {
    expect(DEFAULT_PRIORITIES.BOUT_RESULT).toBeGreaterThan(BOUT_REPEAT_CALL_PRIORITY)
    expect(BOUT_REPEAT_CALL_PRIORITY).toBeGreaterThan(DEFAULT_PRIORITIES.BOUT_CALL)
    expect(DEFAULT_PRIORITIES.BOUT_CALL).toBeGreaterThan(DEFAULT_PRIORITIES.BOUT_PREPARE)
  })

  it('plays award call before award prepare', () => {
    expect(DEFAULT_PRIORITIES.AWARD_CALL).toBeGreaterThan(DEFAULT_PRIORITIES.AWARD_PREPARE)
  })

  it('keeps repeat-call buckets aligned with total wait time', () => {
    const episodeStart = 1_000_000
    const totalWaitMs = 65_000
    const nowMs = episodeStart + totalWaitMs
    expect(repeatBucket(nowMs, episodeStart)).toBe(2)
    expect(repeatBucket(nowMs, nowMs - totalWaitMs)).toBe(2)
  })
})
