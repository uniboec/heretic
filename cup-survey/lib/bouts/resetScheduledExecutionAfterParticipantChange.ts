import type { MatControlExecution } from './mat-control/types'

/**
 * SAFE_CASCADE branch B: participant changed after pre-fight events.
 * Events remain on old attemptNumber; execution moves to fresh attempt.
 */
export function resetScheduledExecutionAfterParticipantChange(
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
