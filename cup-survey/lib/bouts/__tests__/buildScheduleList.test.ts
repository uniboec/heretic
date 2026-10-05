import { describe, expect, it } from 'vitest'
import { buildInterleavedScheduleList, buildTimeSortedScheduleList } from '../buildScheduleList'

describe('buildInterleavedScheduleList', () => {
  it('interleaves bouts round-by-round across mats', () => {
    const mats = [
      { matIndex: 1, bouts: ['a1', 'a2'] },
      { matIndex: 2, bouts: ['b1', 'b2', 'b3'] },
    ]
    expect(buildInterleavedScheduleList(mats)).toEqual(['a1', 'b1', 'a2', 'b2', 'b3'])
  })

  it('returns empty list when no mats', () => {
    expect(buildInterleavedScheduleList([])).toEqual([])
  })
})

describe('buildTimeSortedScheduleList', () => {
  it('sorts all mats by estimated start time', () => {
    const mats = [
      {
        matIndex: 1,
        bouts: [
          { id: 'a2', matIndex: 1, matchNumber: 2, timing: { estimatedStartAt: '2026-10-03T05:09:00.000Z' } },
          { id: 'a1', matIndex: 1, matchNumber: 1, timing: { estimatedStartAt: '2026-10-03T05:00:00.000Z' } },
        ],
      },
      {
        matIndex: 2,
        bouts: [
          { id: 'b1', matIndex: 2, matchNumber: 1, timing: { estimatedStartAt: '2026-10-03T05:06:00.000Z' } },
        ],
      },
    ]

    expect(buildTimeSortedScheduleList(mats).map((bout) => bout.id)).toEqual(['a1', 'b1', 'a2'])
  })

  it('falls back to mat and bout order when timing is missing', () => {
    const mats = [
      {
        matIndex: 2,
        bouts: [{ id: 'b1', matIndex: 2, matchNumber: 1 }],
      },
      {
        matIndex: 1,
        bouts: [{ id: 'a1', matIndex: 1, matchNumber: 1 }],
      },
    ]

    expect(buildTimeSortedScheduleList(mats).map((bout) => bout.id)).toEqual(['a1', 'b1'])
  })
})
