import type { InternalBout } from './types'
import type { MatBoutCompletionExecution } from './matBoutCompletion'
import { isMatBoutCompleted } from './matBoutCompletion'
import type { BoutDisplayStatus } from './presentation/boutDisplayStatus'

export type MatBoutNavItem = {
  boutId: string
  scheduleDisplayNumber: string
  categoryTitle: string
  discipline: string
  boutPhase: string
  isCompleted: boolean
  displayStatus: BoutDisplayStatus
}

export function buildMatBoutsNav(input: {
  orderedMatBouts: InternalBout[]
  executions: MatBoutCompletionExecution[]
  displayStatuses: Map<string, BoutDisplayStatus>
}): MatBoutNavItem[] {
  const executionByBoutId = new Map(input.executions.map((row) => [row.boutId, row]))

  return input.orderedMatBouts.map((bout) => {
    const execution = executionByBoutId.get(bout.id)
    const boutPhase = execution?.boutPhase ?? 'scheduled'
    return {
      boutId: bout.id,
      scheduleDisplayNumber: bout.scheduleDisplayNumber ?? '',
      categoryTitle: bout.categoryTitle,
      discipline: bout.discipline,
      boutPhase,
      isCompleted: execution ? isMatBoutCompleted(execution) : false,
      displayStatus: input.displayStatuses.get(bout.id) ?? 'scheduled',
    }
  })
}
