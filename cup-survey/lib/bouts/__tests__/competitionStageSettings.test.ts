import { describe, expect, it } from 'vitest'
import { CompetitionStageSettingsPatchSchema } from '../schemas'
import { diffStageSettings, normalizeCompetitionStageSettings } from '../competitionStageSettings'
import { maxConfiguredStage } from '../competitionStages'

describe('competitionStageSettings', () => {
  it('strips invalid keys and values defensively', () => {
    const normalized = normalizeCompetitionStageSettings({
      breaksAfterStageMinutes: {
        foo: 10,
        '999': 5,
        '1': 3.9,
        '2': -1,
        '3': 10,
      },
      notBeforeStartTimes: {
        '1': '13:00',
        '2': '25:99',
        '3': '13:30',
        bad: '10:00',
      },
    })

    expect(normalized.breaksAfterStageMinutes).toEqual({ '3': 10 })
    expect(normalized.notBeforeStartTimes).toEqual({ '3': '13:30' })
  })

  it('maxConfiguredStage ignores invalid keys', () => {
    expect(
      maxConfiguredStage(
        normalizeCompetitionStageSettings({
          breaksAfterStageMinutes: { foo: 1, '4': 5 },
          notBeforeStartTimes: { '2': '12:00' },
        }),
      ),
    ).toBe(4)
  })

  it('diffStageSettings tracks notBefore and break changes', () => {
    const oldSettings = normalizeCompetitionStageSettings({
      breaksAfterStageMinutes: { '1': 10 },
      notBeforeStartTimes: { '2': '13:00' },
    })
    const newSettings = normalizeCompetitionStageSettings({
      breaksAfterStageMinutes: { '1': 15 },
      notBeforeStartTimes: { '2': '13:30' },
    })
    const diff = diffStageSettings(oldSettings, newSettings)
    expect(diff.breakAfterChanges).toHaveLength(1)
    expect(diff.notBeforeChanges).toHaveLength(1)
  })

  it('rejects unknown fields in PATCH schema', () => {
    const parsed = CompetitionStageSettingsPatchSchema.safeParse({
      breaksAfterStageMinutes: { '1': 10 },
      extra: true,
    })
    expect(parsed.success).toBe(false)
  })
})
