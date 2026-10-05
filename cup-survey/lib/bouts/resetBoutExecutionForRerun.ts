import type { MatControlExecution } from './mat-control/types'

/** Full attempt reset after branch recovery INVALIDATED downstream bout. */
export function resetBoutExecutionForRerun(
  execution: MatControlExecution,
): MatControlExecution {
  return {
    ...execution,
    boutPhase: 'scheduled',
    clockState: 'idle',
    currentPeriod: 'main',
    activityCorrectionMode: false,
    periodCorrectionMode: false,
    actualStartAt: null,
    actualEndAt: null,
    officialStartedAt: null,
    officialEndedAt: null,
    mainEndedAt: null,
    extraEndedAt: null,
    clockStartedAt: null,
    clockElapsedBeforeStartMs: 0,
    liveSnapshot: null,
    attemptNumber: execution.attemptNumber + 1,
    liveRevision: execution.liveRevision + 1,
  }
}
