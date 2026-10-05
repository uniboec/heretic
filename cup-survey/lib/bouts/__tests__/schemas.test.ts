import { describe, expect, it } from 'vitest'
import {
  AdminBoutsDashboardSchema,
  AdminBoutsSettingsPatchSchema,
  CorrectHistoricalScheduleNumberSchema,
} from '../schemas'

describe('AdminBoutsDashboardSchema', () => {
  it('accepts empty matStartTimeOverrides', () => {
    const parsed = AdminBoutsDashboardSchema.safeParse({
      generatedAt: '2026-10-03T05:00:00.000Z',
      scheduleVersion: 0,
      matsEnabled: true,
      scheduleLegacyGap: false,
      settings: {
        publicEnabled: true,
        matCount: 3,
        matsEnabled: true,
        scheduleVersion: 0,
        scheduleLegacyGap: false,
        autoMatAssignMode: 'BY_CATEGORY',
        autoMatByCategoryEnabled: true,
        boutsStartTime: '10:00',
        matStartTimeOverrides: {},
        boutBreakMinutes: 3,
        ageDivisionDurationOverrides: {},
        pinAllFinalsToEnd: false,
        competitionStageSettings: {
          breaksAfterStageMinutes: {},
          notBeforeStartTimes: {},
        },
        athleteParticipationSpacing: {
          enabled: false,
          mode: 'BOUT_COUNT',
          regular: 2,
          medal: 5,
        },
      },
      published: false,
      publishedAt: null,
      mats: [],
      scheduleOverrides: {},
      groupingWarnings: [],
    })

    expect(parsed.success).toBe(true)
  })
})

describe('CorrectHistoricalScheduleNumberSchema', () => {
  it('rejects client-provided newFormatted field', () => {
    const parsed = CorrectHistoricalScheduleNumberSchema.safeParse({
      boutId: 'cat::bout-1',
      newMatNumber: 1,
      newPosition: 2,
      reason: 'typo fix',
      expectedScheduleVersion: 3,
      newFormatted: '1-99',
    })
    expect(parsed.success).toBe(false)
  })
})

describe('AdminBoutsSettingsPatchSchema', () => {
  it('rejects unknown fields with strict schema', () => {
    const parsed = AdminBoutsSettingsPatchSchema.safeParse({
      unknownField: true,
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts autoMatAssignMode without matCount draft fields', () => {
    const parsed = AdminBoutsSettingsPatchSchema.safeParse({
      autoMatAssignMode: 'BY_CATEGORY',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts autoMatByCategoryEnabled marker field', () => {
    const parsed = AdminBoutsSettingsPatchSchema.safeParse({ autoMatByCategoryEnabled: false })
    expect(parsed.success).toBe(true)
  })

  it('accepts time-weighted autoMatAssignMode values', () => {
    expect(
      AdminBoutsSettingsPatchSchema.safeParse({ autoMatAssignMode: 'BY_BOUT_TIME' }).success,
    ).toBe(true)
    expect(
      AdminBoutsSettingsPatchSchema.safeParse({ autoMatAssignMode: 'BY_CATEGORY_TIME' }).success,
    ).toBe(true)
  })

  it('accepts partial matStartTimeOverrides for a single mat', () => {
    const parsed = AdminBoutsSettingsPatchSchema.safeParse({
      boutsStartTime: '10:00',
      matStartTimeOverrides: { '1': '11:30' },
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.matStartTimeOverrides).toEqual({ '1': '11:30' })
    }
  })

  it('requires draftId and expectedVersion when matCount changes', () => {
    const parsed = AdminBoutsSettingsPatchSchema.safeParse({ matCount: 2 })
    expect(parsed.success).toBe(false)
  })

  it('rejects orphan demotionToken without confirmFixedDemotion', () => {
    const parsed = AdminBoutsSettingsPatchSchema.safeParse({
      matCount: 2,
      draftId: 'draft',
      expectedVersion: 1,
      demotionToken: 'token',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects confirm fields without matCount (Zod B)', () => {
    const parsed = AdminBoutsSettingsPatchSchema.safeParse({
      confirmFixedDemotion: true,
      demotionToken: 'token',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts paired confirmation with matCount', () => {
    const parsed = AdminBoutsSettingsPatchSchema.safeParse({
      matCount: 2,
      draftId: 'draft',
      expectedVersion: 1,
      confirmFixedDemotion: true,
      demotionToken: 'token',
    })
    expect(parsed.success).toBe(true)
  })
})
