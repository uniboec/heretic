import { describe, expect, it } from 'vitest'
import { shouldPreserveStoredPodiumOnForfeitRead } from '../forfeitPodiumGuard'

describe('shouldPreserveStoredPodiumOnForfeitRead', () => {
  it('returns true for stored complete podium', () => {
    expect(
      shouldPreserveStoredPodiumOnForfeitRead({
        status: 'complete',
        placements: [{ entryId: 'a1', placement: 1, reason: 'FINAL_WINNER' }],
      }),
    ).toBe(true)
  })

  it('returns false for in_progress or missing result', () => {
    expect(shouldPreserveStoredPodiumOnForfeitRead({ status: 'in_progress', placements: [] })).toBe(
      false,
    )
    expect(shouldPreserveStoredPodiumOnForfeitRead(null)).toBe(false)
  })
})
