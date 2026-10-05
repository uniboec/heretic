import type { BracketWorkflowStepId } from '@/lib/brackets/labels'

export type WorkflowStepState = 'complete' | 'active' | 'blocked' | 'pending'

export function getWorkflowStepStates(input: {
  globalCompositionStale: boolean
  registrationDataStale: boolean
  eligibilityCriteriaStale: boolean
  staleRedrawCount: number
  controlsEnabled: boolean
  publicVisibleCount: number
  boutsReleasedCount: number
  independentBoutsRelease: boolean
  categoryCount: number
}): Record<BracketWorkflowStepId, WorkflowStepState> {
  const syncNeeded =
    input.globalCompositionStale ||
    input.registrationDataStale ||
    input.eligibilityCriteriaStale

  const sync: WorkflowStepState =
    input.categoryCount === 0 ? 'pending' : syncNeeded ? 'active' : 'complete'

  const redraw: WorkflowStepState = syncNeeded
    ? 'blocked'
    : input.staleRedrawCount > 0
      ? 'active'
      : input.categoryCount === 0
        ? 'pending'
        : 'complete'

  const visibility: WorkflowStepState = !input.controlsEnabled
    ? 'blocked'
    : input.publicVisibleCount > 0
      ? 'complete'
      : redraw === 'complete' || (redraw !== 'blocked' && input.categoryCount > 0)
        ? 'active'
        : 'pending'

  const boutsRelease: WorkflowStepState = !input.controlsEnabled
    ? 'blocked'
    : !input.independentBoutsRelease
      ? visibility === 'complete' || input.publicVisibleCount > 0
        ? 'complete'
        : visibility === 'blocked'
          ? 'blocked'
          : 'pending'
      : input.boutsReleasedCount > 0
        ? 'complete'
        : visibility === 'complete' || input.publicVisibleCount > 0
          ? 'active'
          : visibility === 'blocked'
            ? 'blocked'
            : 'pending'

  const backup: WorkflowStepState = 'pending'

  return { sync, redraw, visibility, boutsRelease, backup }
}

export function getWorkflowStepHint(
  stepId: BracketWorkflowStepId,
  state: WorkflowStepState,
): string | null {
  if (state !== 'active' && state !== 'blocked') return null

  switch (stepId) {
    case 'sync':
      return state === 'active'
        ? 'Синхронизируйте заявки по актуальным данным'
        : null
    case 'redraw':
      return state === 'active'
        ? 'Выполните жеребьёвку устаревших категорий'
        : 'Сначала синхронизируйте заявки'
    case 'visibility':
      return state === 'blocked'
        ? 'Сначала синхронизируйте заявки и выполните жеребьёвку'
        : 'Выберите категории для показа на сайте'
    case 'boutsRelease':
      return state === 'blocked'
        ? 'Сначала покажите категории на сайте'
        : 'Добавьте готовые категории в расписание поединков'
    case 'backup':
      return null
    default:
      return null
  }
}
