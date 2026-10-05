import type { MatControlExecution, StoppageTrigger } from './mat-control/types'

export function resolveOfficialEndedAt(
  execution: MatControlExecution,
  trigger: StoppageTrigger,
): Date {
  if (execution.officialEndedAt) {
    return execution.officialEndedAt
  }

  if (trigger === 'TIME_EXPIRED') {
    if (execution.currentPeriod === 'extra' && execution.extraEndedAt) {
      return execution.extraEndedAt
    }
    if (execution.currentPeriod === 'main' && execution.mainEndedAt) {
      return execution.mainEndedAt
    }
  }

  if (
    (trigger === 'EXTRA_ACTIVITY' || trigger === 'ACTIVITY_CORRECTION') &&
    execution.extraEndedAt
  ) {
    return execution.extraEndedAt
  }

  return new Date()
}
