import { describe, expect, it } from 'vitest'
import { normalizeBoutsPageSettings } from '../normalizeBoutsPageSettings'
import {
  buildPlannedStageContext,
  buildStageTimingSummary,
  resolveStagePlannedStart,
} from '../stageTiming'
import { makeTestScheduledBout } from './testBoutHelpers'

const settings = normalizeBoutsPageSettings({
  publicEnabled: true,
  matCount: 2,
  autoMatAssignMode: 'BY_BOUT',
  autoMatByCategoryEnabled: true,
  boutsStartTime: '10:00',
  matStartTimeOverrides: {},
  boutBreakMinutes: 3,
  ageDivisionDurationOverrides: {},
  pinAllFinalsToEnd: false,
  competitionStageSettings: {
    breaksAfterStageMinutes: { '1': 10 },
    notBeforeStartTimes: { '3': '13:00' },
  },
})

describe('scheduleService stage timing helpers', () => {
  it('usedStages=[3] with notBefore(3)=13:00 yields planned start at 13:00', () => {
    const stage1 = makeTestScheduledBout({
      id: 's1',
      competitionStage: 1,
      timing: {
        scheduledEndAt: '2026-10-03T08:00:00.000Z',
        estimatedEndAt: '2026-10-03T08:00:00.000Z',
      },
    })
    const stage3 = makeTestScheduledBout({ id: 's3', competitionStage: 3, matIndex: 2 })
    const allBouts = [stage1, stage3]
    const plannedEndAtByBout = new Map([
      ['s1', new Date('2026-10-03T08:00:00.000Z')],
      ['s3', new Date('2026-10-03T13:03:00.000Z')],
    ])
    const plannedCtx = buildPlannedStageContext({
      allBouts,
      plannedEndAtByBout,
      pageSettings: settings,
      eventDate: '2026-10-03',
    })

    const plannedStart = resolveStagePlannedStart(3, plannedCtx)
    expect(plannedStart.getTime()).toBeGreaterThanOrEqual(new Date('2026-10-03T08:10:00.000Z').getTime())

    const summaries = buildStageTimingSummary({
      usedStages: [1, 3],
      allTimedBouts: allBouts,
      plannedCtx,
      pageSettings: settings,
      eventDate: '2026-10-03',
    })
    const stage3Summary = summaries.find((summary) => summary.stage === 3)
    expect(stage3Summary?.notBeforeStartAt).toBeDefined()
    expect(stage3Summary?.gapAfterPreviousMinutes).toBe(10)
  })
})
