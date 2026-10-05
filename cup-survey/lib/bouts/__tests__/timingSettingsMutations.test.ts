import { describe, expect, it, vi } from 'vitest'
import { normalizeBoutsPageSettings } from '../normalizeBoutsPageSettings'
import {
  assertTimingSettingsNotFrozen,
  clearRemovedMatScheduleState,
} from '../timingSettingsMutations'
import { pruneMatStartTimeOverridesForMatCount } from '../startTimes'
import { TimingSettingsFrozenError } from '../errors'

describe('timingSettingsMutations', () => {
  const baseSettings = normalizeBoutsPageSettings({
    publicEnabled: true,
    matCount: 3,
    autoMatAssignMode: 'BY_CATEGORY',
    autoMatByCategoryEnabled: true,
    boutsStartTime: '10:00',
    matStartTimeOverrides: { '1': '10:00', '2': '10:30', '3': '11:00' },
    boutBreakMinutes: 3,
    ageDivisionDurationOverrides: {},
  })

  it('M4: allows no-op PATCH of boutBreakMinutes after tournament start', () => {
    expect(() =>
      assertTimingSettingsNotFrozen({
        before: baseSettings,
        after: { ...baseSettings, boutBreakMinutes: baseSettings.boutBreakMinutes },
        executions: [
          {
            boutId: 'b1',
            actualStartAt: new Date('2026-10-03T05:00:00.000Z'),
            actualEndAt: null,
          },
        ],
        mats: [{ matIndex: 1, bouts: [] }],
      }),
    ).not.toThrow()
  })

  it('rejects changing boutBreakMinutes after tournament start', () => {
    expect(() =>
      assertTimingSettingsNotFrozen({
        before: baseSettings,
        after: { ...baseSettings, boutBreakMinutes: baseSettings.boutBreakMinutes + 1 },
        executions: [
          {
            boutId: 'b1',
            actualStartAt: new Date('2026-10-03T05:00:00.000Z'),
            actualEndAt: null,
          },
        ],
        mats: [{ matIndex: 1, bouts: [] }],
      }),
    ).toThrow(TimingSettingsFrozenError)
  })

  it('M2: clears removed mat override without resurrect on restore', async () => {
    const pruned = await clearRemovedMatScheduleState({} as never, {
      oldMatCount: 3,
      newMatCount: 2,
      matStartTimeOverrides: baseSettings.matStartTimeOverrides,
      mats: [{ matIndex: 3, bouts: [] }],
      executions: [],
    })

    expect(pruned['3']).toBeUndefined()
    expect(pruned['1']).toBe('10:00')

    const restored = pruneMatStartTimeOverridesForMatCount(pruned, 3)
    expect(restored['3']).toBeUndefined()
  })

  it('rejects changing effective mat start after mat has started', () => {
    expect(() =>
      assertTimingSettingsNotFrozen({
        before: baseSettings,
        after: {
          ...baseSettings,
          matStartTimeOverrides: { ...baseSettings.matStartTimeOverrides, '1': '11:30' },
        },
        executions: [
          {
            boutId: 'b1',
            actualStartAt: new Date('2026-10-03T05:00:00.000Z'),
            actualEndAt: null,
          },
        ],
        mats: [
          {
            matIndex: 1,
            bouts: [
              {
                id: 'b1',
                matchNumber: 1,
                categoryKey: 'tactic_control:novice:m_boys_1:w1',
                categoryTitle: 'Test',
                discipline: 'tactic_control',
                storedMatIndex: 1,
                sideA: { kind: 'bye' },
                sideB: { kind: 'bye' },
              },
            ],
          },
        ],
      }),
    ).toThrow(TimingSettingsFrozenError)
  })

  it('allows no-op effective mat start PATCH after mat has started', () => {
    expect(() =>
      assertTimingSettingsNotFrozen({
        before: baseSettings,
        after: baseSettings,
        executions: [
          {
            boutId: 'b1',
            actualStartAt: new Date('2026-10-03T05:00:00.000Z'),
            actualEndAt: null,
          },
        ],
        mats: [{ matIndex: 1, bouts: [{ id: 'b1' } as never] }],
      }),
    ).not.toThrow()
  })
})
