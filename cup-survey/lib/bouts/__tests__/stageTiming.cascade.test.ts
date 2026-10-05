import { describe, expect, it } from 'vitest'
import { normalizeBoutsPageSettings } from '../normalizeBoutsPageSettings'
import {
  applyStageFloorToAllMats,
  buildPlannedStageContext,
  buildStageTimingSummary,
  resolveEstimatedStageStart,
  rippleLaterBoutsOnAffectedMats,
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
    breaksAfterStageMinutes: { '1': 10, '2': 5 },
    notBeforeStartTimes: {},
  },
})

describe('stage timing cascade', () => {
  it('shifts stage 2 and 3 when mat 1 stage 1 finishes early', () => {
    const stage1Mat1 = makeTestScheduledBout({
      id: 's1m1',
      competitionStage: 1,
      matIndex: 1,
      timing: {
        status: 'completed',
        actualStartAt: '2026-10-03T05:00:00.000Z',
        actualEndAt: '2026-10-03T05:30:00.000Z',
        scheduledEndAt: '2026-10-03T06:00:00.000Z',
        estimatedEndAt: '2026-10-03T05:30:00.000Z',
      },
    })
    const stage2Mat1 = makeTestScheduledBout({
      id: 's2m1',
      competitionStage: 2,
      matIndex: 1,
      timing: {
        scheduledStartAt: '2026-10-03T06:10:00.000Z',
        scheduledEndAt: '2026-10-03T06:13:00.000Z',
        estimatedStartAt: '2026-10-03T06:10:00.000Z',
        estimatedEndAt: '2026-10-03T06:13:00.000Z',
      },
    })
    const stage3Mat2 = makeTestScheduledBout({
      id: 's3m2',
      competitionStage: 3,
      matIndex: 2,
      timing: {
        scheduledStartAt: '2026-10-03T07:00:00.000Z',
        scheduledEndAt: '2026-10-03T07:03:00.000Z',
        estimatedStartAt: '2026-10-03T07:00:00.000Z',
        estimatedEndAt: '2026-10-03T07:03:00.000Z',
      },
    })
    const allBouts = [stage1Mat1, stage2Mat1, stage3Mat2]
    const plannedCtx = buildPlannedStageContext({
      allBouts,
      plannedEndAtByBout: new Map([
        ['s1m1', new Date('2026-10-03T06:00:00.000Z')],
        ['s2m1', new Date('2026-10-03T06:13:00.000Z')],
        ['s3m2', new Date('2026-10-03T07:03:00.000Z')],
      ]),
      pageSettings: settings,
      eventDate: '2026-10-03',
    })

    const stage2Floor = resolveEstimatedStageStart({
      stage: 2,
      allTimedBouts: allBouts,
      plannedCtx,
      pageSettings: settings,
      eventDate: '2026-10-03',
    })
    applyStageFloorToAllMats(2, stage2Floor, allBouts)
    rippleLaterBoutsOnAffectedMats(2, allBouts, settings)

    const stage3Floor = resolveEstimatedStageStart({
      stage: 3,
      allTimedBouts: allBouts,
      plannedCtx,
      pageSettings: settings,
      eventDate: '2026-10-03',
    })
    applyStageFloorToAllMats(3, stage3Floor, allBouts)

    const summaries = buildStageTimingSummary({
      usedStages: [1, 2, 3],
      allTimedBouts: allBouts,
      plannedCtx,
      pageSettings: settings,
      eventDate: '2026-10-03',
    })

    const stage2Summary = summaries.find((summary) => summary.stage === 2)
    expect(stage2Summary?.estimatedStartAt).toBeDefined()
    expect(
      new Date(stage2Summary!.estimatedStartAt).getTime(),
    ).toBeGreaterThanOrEqual(stage2Floor.getTime())
    expect(
      new Date(stage2Summary!.estimatedStartAt).getTime(),
    ).toBeGreaterThanOrEqual(new Date(stage2Summary!.plannedStartAt).getTime() - 60_000)
  })

  it('never mutates actual timings of started or completed bouts', () => {
    const completed = makeTestScheduledBout({
      id: 'done',
      competitionStage: 1,
      timing: {
        status: 'completed',
        actualStartAt: '2026-10-03T05:00:00.000Z',
        actualEndAt: '2026-10-03T05:30:00.000Z',
        scheduledStartAt: '2026-10-03T05:00:00.000Z',
        scheduledEndAt: '2026-10-03T06:00:00.000Z',
        estimatedStartAt: '2026-10-03T05:00:00.000Z',
        estimatedEndAt: '2026-10-03T05:30:00.000Z',
      },
    })
    const inProgress = makeTestScheduledBout({
      id: 'live',
      competitionStage: 1,
      matIndex: 2,
      timing: {
        status: 'in_progress',
        actualStartAt: '2026-10-03T05:40:00.000Z',
        scheduledStartAt: '2026-10-03T05:40:00.000Z',
        scheduledEndAt: '2026-10-03T05:43:00.000Z',
        estimatedStartAt: '2026-10-03T05:40:00.000Z',
        estimatedEndAt: '2026-10-03T05:43:00.000Z',
      },
    })
    const upcoming = makeTestScheduledBout({
      id: 'next',
      competitionStage: 2,
      matIndex: 2,
    })
    const bouts = [completed, inProgress, upcoming]
    const beforeCompleted = { ...completed.timing }
    const beforeInProgress = { ...inProgress.timing }

    applyStageFloorToAllMats(2, new Date('2026-10-03T07:00:00.000Z'), bouts)
    rippleLaterBoutsOnAffectedMats(2, bouts, settings)

    expect(completed.timing.actualStartAt).toBe(beforeCompleted.actualStartAt)
    expect(completed.timing.actualEndAt).toBe(beforeCompleted.actualEndAt)
    expect(inProgress.timing.actualStartAt).toBe(beforeInProgress.actualStartAt)
    expect(inProgress.timing.actualEndAt).toBe(beforeInProgress.actualEndAt)
  })
})
