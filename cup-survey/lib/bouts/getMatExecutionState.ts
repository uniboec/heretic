import type { InternalBout } from './types'
import type { ScheduleExecutionRecord } from './scheduleTypes'
import { BoutsScheduleCorruptError, InvalidBoutExecutionStateError } from './errors'
import {
  isBoutExecutionCompleted,
  isBoutExecutionInProgress,
} from './presentation/boutDisplayStatus'

export type MatExecutionClassification = {
  completedIds: string[]
  inProgressId: string | null
  upcomingIds: string[]
}

export function classifyMatExecutions(
  bouts: InternalBout[],
  executions: Map<string, ScheduleExecutionRecord>,
): MatExecutionClassification {
  const completedIds: string[] = []
  let inProgressId: string | null = null
  const upcomingIds: string[] = []

  for (const bout of bouts) {
    const execution = executions.get(bout.id)
    const hasEnd = execution?.actualEndAt != null
    const hasStart = execution?.actualStartAt != null

    if (hasEnd && !hasStart) {
      throw new InvalidBoutExecutionStateError('END_WITHOUT_START')
    }

    if (execution && isBoutExecutionCompleted(execution)) {
      completedIds.push(bout.id)
      continue
    }

    if (execution && isBoutExecutionInProgress(execution)) {
      if (inProgressId) {
        throw new InvalidBoutExecutionStateError('MULTIPLE_IN_PROGRESS')
      }
      inProgressId = bout.id
      continue
    }

    upcomingIds.push(bout.id)
  }

  return { completedIds, inProgressId, upcomingIds }
}

export function getMatExecutionState(
  bouts: InternalBout[],
  executions: Map<string, ScheduleExecutionRecord>,
  failClosed: boolean,
): MatExecutionClassification {
  try {
    return classifyMatExecutions(bouts, executions)
  } catch (error) {
    if (failClosed && error instanceof InvalidBoutExecutionStateError) {
      throw new BoutsScheduleCorruptError(error.message)
    }
    throw error
  }
}
