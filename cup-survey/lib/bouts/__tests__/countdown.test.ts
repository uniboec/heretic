import { describe, expect, it } from 'vitest'
import { formatCountdownLabel, minutesUntil } from '../countdown'

describe('countdown', () => {
  it('computes minutes until estimated start from referenceNow', () => {
    const referenceNow = new Date('2026-10-03T05:00:00.000Z')
    const estimatedStartAt = '2026-10-03T05:07:30.000Z'

    expect(minutesUntil(estimatedStartAt, referenceNow)).toBe(8)
    expect(formatCountdownLabel(estimatedStartAt, referenceNow)).toBe('через 8 мин')
  })

  it('returns null when estimated start is in the past', () => {
    const referenceNow = new Date('2026-10-03T06:00:00.000Z')
    expect(minutesUntil('2026-10-03T05:00:00.000Z', referenceNow)).toBeNull()
    expect(formatCountdownLabel('2026-10-03T05:00:00.000Z', referenceNow)).toBeNull()
  })

  it('returns null when estimated start is on another tournament day', () => {
    const referenceNow = new Date('2026-09-27T12:00:00.000Z')
    expect(formatCountdownLabel('2026-10-03T05:00:00.000Z', referenceNow)).toBeNull()
  })

  it('formats hours on tournament day', () => {
    const referenceNow = new Date('2026-10-03T05:00:00.000Z')
    expect(formatCountdownLabel('2026-10-03T07:15:00.000Z', referenceNow)).toBe('через 2 ч 15 мин')
    expect(formatCountdownLabel('2026-10-03T07:00:00.000Z', referenceNow)).toBe('через 2 ч')
  })
})
