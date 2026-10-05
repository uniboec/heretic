import { describe, expect, it } from 'vitest'
import { normalizeBoutsPageSettings } from '../normalizeBoutsPageSettings'
import { BoutNotReadyError } from '../errors'
import {
  assertStageGateAllowsStart,
  buildStageGatePlannedContext,
} from '../stageGateValidation'
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

describe('assertStageGateAllowsStart', () => {
  it('blocks start before previous stage completes', () => {
    const stage1 = makeTestScheduledBout({
      id: 's1',
      competitionStage: 1,
      timing: { status: 'upcoming' },
    })
    const stage3 = makeTestScheduledBout({
      id: 's3',
      competitionStage: 3,
      matIndex: 2,
    })
    const allBouts = [stage1, stage3]
    const plannedCtx = buildStageGatePlannedContext({
      allBouts,
      pageSettings: settings,
      eventDate: '2026-10-03',
    })

    expect(() =>
      assertStageGateAllowsStart({
        bout: stage3,
        allBoutsOnAllMats: allBouts,
        plannedCtx,
        pageSettings: settings,
        eventDate: '2026-10-03',
        mutationNow: new Date('2026-10-03T05:00:00.000Z'),
      }),
    ).toThrow(BoutNotReadyError)
  })

  it('allows stage 3 only after stage 1 completes and break passes', () => {
    const stage1 = makeTestScheduledBout({
      id: 's1',
      competitionStage: 1,
      timing: {
        status: 'completed',
        actualEndAt: '2026-10-03T08:00:00.000Z',
        scheduledEndAt: '2026-10-03T08:00:00.000Z',
        estimatedEndAt: '2026-10-03T08:00:00.000Z',
      },
    })
    const stage3 = makeTestScheduledBout({
      id: 's3',
      competitionStage: 3,
      timing: {
        scheduledStartAt: '2026-10-03T10:00:00.000Z',
        scheduledEndAt: '2026-10-03T10:03:00.000Z',
        estimatedStartAt: '2026-10-03T10:00:00.000Z',
        estimatedEndAt: '2026-10-03T10:03:00.000Z',
      },
    })
    const allBouts = [stage1, stage3]
    const plannedCtx = buildStageGatePlannedContext({
      allBouts,
      pageSettings: settings,
      eventDate: '2026-10-03',
    })

    expect(() =>
      assertStageGateAllowsStart({
        bout: stage3,
        allBoutsOnAllMats: allBouts,
        plannedCtx,
        pageSettings: settings,
        eventDate: '2026-10-03',
        mutationNow: new Date('2026-10-03T10:00:00.000Z'),
      }),
    ).not.toThrow()
  })

  it('blocks stage 3 at 12:59 when notBefore(3)=13:00', () => {
    const stage3 = makeTestScheduledBout({
      id: 's3',
      competitionStage: 3,
      timing: {
        scheduledStartAt: '2026-10-03T08:00:00.000Z',
        scheduledEndAt: '2026-10-03T08:03:00.000Z',
        estimatedStartAt: '2026-10-03T08:00:00.000Z',
        estimatedEndAt: '2026-10-03T08:03:00.000Z',
      },
    })
    const plannedCtx = buildStageGatePlannedContext({
      allBouts: [stage3],
      pageSettings: settings,
      eventDate: '2026-10-03',
    })

    expect(() =>
      assertStageGateAllowsStart({
        bout: stage3,
        allBoutsOnAllMats: [stage3],
        plannedCtx,
        pageSettings: settings,
        eventDate: '2026-10-03',
        mutationNow: new Date('2026-10-03T07:59:00.000Z'),
      }),
    ).toThrow(BoutNotReadyError)
  })

  it('blocks usedStages=[3] at 09:59 when tournament starts at 10:00', () => {
    const settingsWithoutNotBefore = normalizeBoutsPageSettings({
      publicEnabled: true,
      matCount: 1,
      autoMatAssignMode: 'BY_BOUT',
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
    })
    const stage3 = makeTestScheduledBout({
      id: 's3',
      competitionStage: 3,
      timing: {
        scheduledStartAt: '2026-10-03T05:00:00.000Z',
        scheduledEndAt: '2026-10-03T05:03:00.000Z',
        estimatedStartAt: '2026-10-03T05:00:00.000Z',
        estimatedEndAt: '2026-10-03T05:03:00.000Z',
      },
    })
    const plannedCtx = buildStageGatePlannedContext({
      allBouts: [stage3],
      pageSettings: settingsWithoutNotBefore,
      eventDate: '2026-10-03',
    })

    expect(() =>
      assertStageGateAllowsStart({
        bout: stage3,
        allBoutsOnAllMats: [stage3],
        plannedCtx,
        pageSettings: settingsWithoutNotBefore,
        eventDate: '2026-10-03',
        mutationNow: new Date('2026-10-03T04:59:00.000Z'),
      }),
    ).toThrow(BoutNotReadyError)
  })
})
