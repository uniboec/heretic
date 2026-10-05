import type { MatControlExecution } from './mat-control/types'

export function startExtraRound(execution: MatControlExecution): MatControlExecution {
  return {
    ...execution,
    currentPeriod: 'extra',
    clockState: 'stopped',
    clockStartedAt: null,
    clockElapsedBeforeStartMs: 0,
    extraEndedAt: null,
    periodCorrectionMode: false,
  }
}
