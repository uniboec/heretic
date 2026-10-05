import type { VictoryMethod } from '../config/fseRules'
import type { BoutDecision, MatControlExecution, MatControlSessionRecord } from './mat-control/types'

export type ConfirmBoutResultInput = {
  execution: MatControlExecution
  session: MatControlSessionRecord
  decision: BoutDecision
  victoryMethod: VictoryMethod
  now: Date
  confirmedBy?: string
}

export type ConfirmBoutResultOutput = {
  execution: MatControlExecution
  session: MatControlSessionRecord
  resultPayload: {
    winnerEntryId: string | null
    loserEntryId: string | null
    victoryMethod: VictoryMethod
    decisionReason: string
    decidedInPeriod: string
    officialEndedAt: string
    resultConfirmedAt: string
    confirmedBy?: string
  }
}

export function confirmBoutResult(input: ConfirmBoutResultInput): ConfirmBoutResultOutput {
  if (input.execution.boutPhase !== 'pending_confirmation') {
    throw new Error('confirmBoutResult доступен только в pending_confirmation')
  }

  const execution: MatControlExecution = {
    ...input.execution,
    boutPhase: 'confirmed',
    actualStartAt:
      input.execution.actualStartAt ?? input.execution.officialStartedAt ?? input.now,
    actualEndAt: input.now,
  }

  const session: MatControlSessionRecord = {
    ...input.session,
    activeBoutId: input.session.activeBoutId ?? input.execution.boutId,
  }

  return {
    execution,
    session,
    resultPayload: {
      winnerEntryId: input.decision.winnerEntryId,
      loserEntryId: input.decision.loserEntryId,
      victoryMethod: input.victoryMethod,
      decisionReason: input.decision.reason,
      decidedInPeriod: input.decision.decidedInPeriod,
      officialEndedAt: (execution.officialEndedAt ?? input.now).toISOString(),
      resultConfirmedAt: input.now.toISOString(),
      confirmedBy: input.confirmedBy,
    },
  }
}
