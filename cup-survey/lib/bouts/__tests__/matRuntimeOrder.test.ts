import { describe, expect, it } from 'vitest'
import { orderMatBoutsForRuntime } from '../matRuntimeOrder'
import { renumberManualOrderForMat } from '../scheduleOverrideMutations'
import { normalizeBoutsPageSettings } from '../normalizeBoutsPageSettings'
import type { InternalBout } from '../types'

function makeBout(id: string, matchNumber: number): InternalBout {
  return {
    id,
    matchNumber,
    categoryKey: 'cat-a',
    categoryTitle: 'Test',
    discipline: 'tactic_control',
    storedMatIndex: 1,
    competitionStage: 1,
    schedulePhase: 'elimination',
    round: 1,
    roundsUntilFinal: 2,
    sideA: {
      kind: 'athlete',
      entryId: `${id}-a`,
      displayName: 'A',
      clubName: 'C',
      city: 'X',
      publicNumber: 1,
    },
    sideB: {
      kind: 'athlete',
      entryId: `${id}-b`,
      displayName: 'B',
      clubName: 'C',
      city: 'X',
      publicNumber: 2,
    },
  }
}

describe('orderMatBoutsForRuntime', () => {
  it('respects manual order overrides on the mat', () => {
    const bouts = [makeBout('bout-1', 1), makeBout('bout-2', 2), makeBout('bout-3', 3)]
    const overrides = renumberManualOrderForMat(bouts, ['bout-2', 'bout-3', 'bout-1'], {})
    const settings = normalizeBoutsPageSettings({
      id: 'default',
      matCount: 1,
      publicEnabled: true,
      autoMatAssignMode: 'off',
      autoMatByCategoryEnabled: false,
      pinAllFinalsToEnd: false,
      boutsStartTime: '10:00',
      matStartTimeOverrides: null,
      boutBreakMinutes: 3,
      ageDivisionDurationOverrides: null,
      competitionStageSettings: null,
    })

    const ordered = orderMatBoutsForRuntime({
      groupedMats: [{ matIndex: 1, bouts }],
      matIndex: 1,
      overrides,
      settings,
    })

    expect(ordered.map((bout) => bout.id)).toEqual(['bout-2', 'bout-3', 'bout-1'])
  })

  it('applies mat postpone queue-after overrides on top of schedule order', () => {
    const bouts = [makeBout('bout-1', 1), makeBout('bout-2', 2), makeBout('bout-3', 3)]
    const settings = normalizeBoutsPageSettings({
      id: 'default',
      matCount: 1,
      publicEnabled: true,
      autoMatAssignMode: 'off',
      autoMatByCategoryEnabled: false,
      pinAllFinalsToEnd: false,
      boutsStartTime: '10:00',
      matStartTimeOverrides: null,
      boutBreakMinutes: 3,
      ageDivisionDurationOverrides: null,
      competitionStageSettings: null,
    })

    const ordered = orderMatBoutsForRuntime({
      groupedMats: [{ matIndex: 1, bouts }],
      matIndex: 1,
      overrides: {
        'bout-1': { queueAfterBoutId: 'bout-2' },
      },
      settings,
    })

    expect(ordered.map((bout) => bout.id)).toEqual(['bout-2', 'bout-1', 'bout-3'])
  })
})
