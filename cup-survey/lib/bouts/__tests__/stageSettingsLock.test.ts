import { describe, expect, it } from 'vitest'
import { assertStageSettingsPatchAllowed } from '../stageSettingsLock'
import { StageSettingsLockedError } from '../errors'
import { normalizeCompetitionStageSettings } from '../competitionStageSettings'
import { makeTestScheduledBout } from './testBoutHelpers'

describe('assertStageSettingsPatchAllowed', () => {
  const base = normalizeCompetitionStageSettings({
    breaksAfterStageMinutes: { '1': 10 },
    notBeforeStartTimes: { '2': '13:00', '3': '14:00' },
  })

  it('locks notBefore after stage has started', () => {
    const stage2Bout = makeTestScheduledBout({ id: 's2', competitionStage: 2 })
    expect(() =>
      assertStageSettingsPatchAllowed({
        oldSettings: base,
        newSettings: normalizeCompetitionStageSettings({
          ...base,
          notBeforeStartTimes: { ...base.notBeforeStartTimes, '2': '13:30' },
        }),
        allBouts: [makeTestScheduledBout({ id: 's1', competitionStage: 1 }), stage2Bout],
        executions: [
          {
            boutId: 's2',
            actualStartAt: new Date('2026-10-03T08:00:00.000Z'),
            actualEndAt: null,
          },
        ],
        boutsStartTimeChanged: false,
        boutBreakMinutesChanged: false,
      }),
    ).toThrow(StageSettingsLockedError)
  })

  it('locks boutsStartTime after first used stage has started', () => {
    expect(() =>
      assertStageSettingsPatchAllowed({
        oldSettings: base,
        newSettings: base,
        allBouts: [makeTestScheduledBout({ id: 's1', competitionStage: 1 })],
        executions: [
          {
            boutId: 's1',
            actualStartAt: new Date('2026-10-03T05:00:00.000Z'),
            actualEndAt: null,
          },
        ],
        boutsStartTimeChanged: true,
        boutBreakMinutesChanged: false,
      }),
    ).toThrow(StageSettingsLockedError)
  })

  it('locks boutBreakMinutes after second used stage has started', () => {
    expect(() =>
      assertStageSettingsPatchAllowed({
        oldSettings: base,
        newSettings: base,
        allBouts: [
          makeTestScheduledBout({ id: 's1', competitionStage: 1 }),
          makeTestScheduledBout({ id: 's2', competitionStage: 2 }),
        ],
        executions: [
          {
            boutId: 's2',
            actualStartAt: new Date('2026-10-03T08:00:00.000Z'),
            actualEndAt: null,
          },
        ],
        boutsStartTimeChanged: false,
        boutBreakMinutesChanged: true,
      }),
    ).toThrow(StageSettingsLockedError)
  })

  it('does not lock breakAfter[2] when usedStages=[1,3]', () => {
    expect(() =>
      assertStageSettingsPatchAllowed({
        oldSettings: base,
        newSettings: normalizeCompetitionStageSettings({
          ...base,
          breaksAfterStageMinutes: { ...base.breaksAfterStageMinutes, '2': 15 },
        }),
        allBouts: [
          makeTestScheduledBout({ id: 's1', competitionStage: 1 }),
          makeTestScheduledBout({ id: 's3', competitionStage: 3 }),
        ],
        executions: [
          {
            boutId: 's3',
            actualStartAt: new Date('2026-10-03T10:00:00.000Z'),
            actualEndAt: null,
          },
        ],
        boutsStartTimeChanged: false,
        boutBreakMinutesChanged: false,
      }),
    ).not.toThrow()
  })
})
