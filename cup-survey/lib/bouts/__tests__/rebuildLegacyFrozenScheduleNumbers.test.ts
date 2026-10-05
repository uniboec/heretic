import { describe, expect, it } from 'vitest'
import {
  buildDynamicScheduleDisplayNumber,
  isStaleLegacyFrozenDisplay,
} from '../scheduleDisplayNumber'

describe('rebuildLegacyFrozenScheduleNumbers helpers', () => {
  it('detects placeholder frozen numbers on the wrong mat', () => {
    expect(
      isStaleLegacyFrozenDisplay({
        frozen: { formatted: '1-31', matNumber: 1, position: 31 },
        matIndex: 2,
        position: 1,
        matsEnabled: true,
      }),
    ).toBe(true)
  })

  it('keeps valid frozen numbers aligned with queue position', () => {
    expect(
      isStaleLegacyFrozenDisplay({
        frozen: { formatted: '2-1', matNumber: 2, position: 1 },
        matIndex: 2,
        position: 1,
        matsEnabled: true,
      }),
    ).toBe(false)
  })

  it('builds dynamic numbers from mat queue position', () => {
    expect(
      buildDynamicScheduleDisplayNumber({
        matIndex: 2,
        position: 6,
        matsEnabled: true,
      }),
    ).toEqual({
      formatted: '2-6',
      matNumber: 2,
      position: 6,
    })
  })
})
