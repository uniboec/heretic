import { describe, expect, it } from 'vitest'
import { getWorkflowStepHint, getWorkflowStepStates } from '../admin/workflow'

describe('bracket workflow status', () => {
  it('blocks visibility until controls are enabled', () => {
    const states = getWorkflowStepStates({
      globalCompositionStale: false,
      registrationDataStale: false,
      eligibilityCriteriaStale: false,
      staleRedrawCount: 0,
      controlsEnabled: false,
      publicVisibleCount: 0,
      boutsReleasedCount: 0,
      independentBoutsRelease: false,
      categoryCount: 2,
    })
    expect(states.visibility).toBe('blocked')
    expect(getWorkflowStepHint('visibility', states.visibility)).toBe(
      'Сначала синхронизируйте заявки и выполните жеребьёвку',
    )
  })
})
