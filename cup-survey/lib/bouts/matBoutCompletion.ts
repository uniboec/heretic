import {
  isBoutExecutionCompleted,
  isBoutExecutionInProgress,
} from './presentation/boutDisplayStatus'

export type MatBoutCompletionExecution = {
  boutId: string
  boutPhase: string
  actualStartAt: Date | null
  actualEndAt: Date | null
  clockStartedAt?: Date | null
  officialStartedAt?: Date | null
}

/** Mat-control completion: confirmed phase, or both schedule timestamps present. */
export function isMatBoutCompleted(execution: MatBoutCompletionExecution): boolean {
  return isBoutExecutionCompleted(execution)
}

export function buildMatCompletedBoutIds(
  executions: MatBoutCompletionExecution[],
): Set<string> {
  return new Set(executions.filter(isMatBoutCompleted).map((execution) => execution.boutId))
}

export function findMatInProgressBoutId(
  executions: MatBoutCompletionExecution[],
  boutIdsOnMat: ReadonlySet<string>,
): string | null {
  for (const execution of executions) {
    if (!boutIdsOnMat.has(execution.boutId) || isMatBoutCompleted(execution)) {
      continue
    }
    if (isBoutExecutionInProgress(execution)) {
      return execution.boutId
    }
  }
  return null
}
