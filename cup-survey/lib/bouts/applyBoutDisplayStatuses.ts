import {
  isBoutExecutionCompleted,
  isBoutExecutionInProgress,
  resolveMatBoutDisplayStatuses,
} from './presentation/boutDisplayStatus'
import type { ScheduleExecutionRecord, ScheduledBout } from './scheduleTypes'

export function applyBoutDisplayStatuses(
  bouts: ScheduledBout[],
  executions: Map<string, ScheduleExecutionRecord>,
): ScheduledBout[] {
  const displayStatuses = resolveMatBoutDisplayStatuses({
    orderedBoutIds: bouts.map((bout) => bout.id),
    executions,
  })

  return bouts.map((bout) => {
    const execution = executions.get(bout.id)
    const displayStatus = displayStatuses.get(bout.id) ?? 'scheduled'
    const timingStatus =
      displayStatus === 'completed'
        ? 'completed'
        : displayStatus === 'in_progress'
          ? 'in_progress'
          : 'upcoming'

    return {
      ...bout,
      timing: {
        ...bout.timing,
        status: timingStatus,
        displayStatus,
      },
    }
  })
}

export function executionTimingStatus(
  execution: ScheduleExecutionRecord | undefined,
): 'upcoming' | 'in_progress' | 'completed' {
  if (!execution) return 'upcoming'
  if (isBoutExecutionCompleted(execution)) return 'completed'
  if (isBoutExecutionInProgress(execution)) return 'in_progress'
  return 'upcoming'
}
