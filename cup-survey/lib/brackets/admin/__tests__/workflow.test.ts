import { describe, expect, it } from 'vitest'
import { getWorkflowStepHint, getWorkflowStepStates } from '../workflow'

const baseInput = {
  globalCompositionStale: false,
  registrationDataStale: false,
  eligibilityCriteriaStale: false,
  staleRedrawCount: 0,
  controlsEnabled: true,
  publicVisibleCount: 0,
  boutsReleasedCount: 0,
  independentBoutsRelease: false,
  categoryCount: 2,
}

describe('bracket admin workflow', () => {
  it('includes boutsRelease and backup step states', () => {
    const states = getWorkflowStepStates(baseInput)
    expect(states.boutsRelease).toBeDefined()
    expect(states.backup).toBe('pending')
    expect(states.sync).toBe('complete')
  })

  it('marks boutsRelease complete in Phase 1 when categories are visible', () => {
    const states = getWorkflowStepStates({
      ...baseInput,
      publicVisibleCount: 1,
    })
    expect(states.boutsRelease).toBe('complete')
  })

  it('marks boutsRelease active in Phase 2 after visibility', () => {
    const states = getWorkflowStepStates({
      ...baseInput,
      independentBoutsRelease: true,
      publicVisibleCount: 1,
    })
    expect(states.boutsRelease).toBe('active')
  })

  it('marks boutsRelease complete in Phase 2 when bouts are released', () => {
    const states = getWorkflowStepStates({
      ...baseInput,
      independentBoutsRelease: true,
      publicVisibleCount: 1,
      boutsReleasedCount: 1,
    })
    expect(states.boutsRelease).toBe('complete')
  })

  it('returns hint for active boutsRelease step', () => {
    const hint = getWorkflowStepHint(
      'boutsRelease',
      getWorkflowStepStates({
        ...baseInput,
        independentBoutsRelease: true,
        publicVisibleCount: 1,
      }).boutsRelease,
    )
    expect(hint).toMatch(/расписание/i)
  })

  it('blocks visibility until controls are enabled', () => {
    const states = getWorkflowStepStates({
      ...baseInput,
      controlsEnabled: false,
    })
    expect(states.visibility).toBe('blocked')
    expect(getWorkflowStepHint('visibility', states.visibility)).toBe(
      'Сначала синхронизируйте заявки и выполните жеребьёвку',
    )
  })
})
