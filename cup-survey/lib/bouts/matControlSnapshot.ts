import type { InternalBout } from './types'
import type { MatControlExecution, MatControlSessionRecord } from './mat-control/types'
import {
  resolveDefaultPeriodDurationMs,
  resolvePeriodCount,
  resolvePeriodDurationMs,
} from './boutLiveSnapshot'
import { computePeriodDeadlineAt, computeRemainingMs } from './stopClockAt'
import {
  reduceScoreEvents,
  computeBoutLiveHints,
  resolveBoutDecision,
  resolveEffectiveBoutDecision,
} from './scoreEngine'
import type { BoutEventRecord, BoutParticipantContext } from './mat-control/types'
import { buildMatQueue, type MatQueueDisplayEntry } from './matQueue'
import type { AgeDivisionDurationOverrides } from './boutDuration'
import { computeAuxiliaryTimers, type AuxiliaryTimersSnapshot } from './auxiliaryTimers'
import type { BoutCorrectionMeta } from './boutCorrectionMeta'
import {
  buildBoutConfirmationSummary,
  type BoutConfirmationSummary,
} from './formatBoutConfirmation'
import {
  getBlockingConfirmIssues,
  resolveProposedVictoryMethod,
  validateConfirmBout,
  type ConfirmValidationIssue,
} from './confirmValidation'
import type { RecentMatBoutSummary } from './recentMatBouts'
import type { AdminSessionRole } from '../auth'
import { buildNextSanctions, type NextSanctionsSnapshot } from './buildNextSanctions'
import { getUndoCandidate, type UndoCandidate } from './getUndoCandidate'
import type { MandateWarning } from '../mandate/types'
import type { MatBoutNavItem } from './buildMatBoutsNav'

export type MatControlBoutSnapshot = {
  boutId: string
  bout: InternalBout
  execution: MatControlExecution
  participants: BoutParticipantContext
  score: ReturnType<typeof reduceScoreEvents>
  hints: ReturnType<typeof computeBoutLiveHints>
  decisionPreview: ReturnType<typeof resolveBoutDecision> | null
  periodDurationMs: number
  defaultPeriodDurationMs: number
  mainPeriodDurationMs: number
  extraPeriodDurationMs: number
  periodCount: 1 | 2
  periodRemainingMs: number
  periodDeadlineAt: string | null
  events: BoutEventRecord[]
  auxiliaryTimers: AuxiliaryTimersSnapshot
  correctionMeta: BoutCorrectionMeta
  confirmationSummary: BoutConfirmationSummary | null
  confirmValidationIssues: ConfirmValidationIssue[]
  confirmGateReason: string | null
  proposedVictoryMethod: ReturnType<typeof resolveProposedVictoryMethod> | null
  fightClockStarted: boolean
  nextSanctions: NextSanctionsSnapshot
  undoCandidate: UndoCandidate | null
}

export type BoutSessionSnapshot = {
  boutSessionId: string
  ownershipEpoch: number
  clientSessionId: string
  sessionStatus: string
  staleAt: string | null
  expectedSequenceNo: number
}

export type MatControlSnapshot = {
  matIndex: number
  matCount: number
  boutSession: BoutSessionSnapshot | null
  /** Other mats available for cross-mat transfer (excludes current mat). */
  moveMatTargetOptions: number[]
  session: MatControlSessionRecord
  activeBout: MatControlBoutSnapshot | null
  /** Runnable bout ids on this mat in runtime queue order (used for postpone). */
  pendingMatBoutIds: string[]
  /** Sport-dependent bouts that move together when postponing the active bout. */
  postponeCascadeBoutIds: string[]
  queue: ReturnType<typeof buildMatQueue>
  /** Pending bouts in runtime mat order (includes active and postponed positions). */
  queueInOrder: MatQueueDisplayEntry[]
  recentBouts: RecentMatBoutSummary[]
  permissions: {
    role: AdminSessionRole
    canCorrectResult: boolean
    canResetBout: boolean
  }
  entryWarnings: Record<string, MandateWarning[]>
  entryAthleteIds: Record<string, string>
  /** All bouts on this mat in runtime order (for prev/next navigation). */
  matBoutsNav: MatBoutNavItem[]
  /** Live or paused bout on the mat, if any. */
  matInProgressBoutId: string | null
  scheduleVersion: number
  now: string
}

export function buildBoutSnapshot(input: {
  bout: InternalBout
  execution: MatControlExecution
  participants: BoutParticipantContext
  events: BoutEventRecord[]
  durationOverrides: AgeDivisionDurationOverrides
  correctionMeta: BoutCorrectionMeta
  now: Date
}): MatControlBoutSnapshot {
  const defaultPeriodDurationMs = resolveDefaultPeriodDurationMs({
    categoryKey: input.bout.categoryKey,
    overrides: input.durationOverrides,
  })
  const mainPeriodDurationMs = resolvePeriodDurationMs({
    liveSnapshot: input.execution.liveSnapshot,
    period: 'main',
    categoryKey: input.bout.categoryKey,
    overrides: input.durationOverrides,
  })
  const extraPeriodDurationMs = resolvePeriodDurationMs({
    liveSnapshot: input.execution.liveSnapshot,
    period: 'extra',
    categoryKey: input.bout.categoryKey,
    overrides: input.durationOverrides,
  })
  const periodDurationMs = resolvePeriodDurationMs({
    liveSnapshot: input.execution.liveSnapshot,
    period: input.execution.currentPeriod,
    categoryKey: input.bout.categoryKey,
    overrides: input.durationOverrides,
  })
  const periodCount = resolvePeriodCount(input.execution.liveSnapshot)

  const mainPeriodScore = reduceScoreEvents(
    input.events,
    'main',
    input.execution.attemptNumber,
  )
  const score = reduceScoreEvents(
    input.events,
    input.execution.currentPeriod,
    input.execution.attemptNumber,
  )
  const hints = computeBoutLiveHints({
    events: input.events,
    period: input.execution.currentPeriod,
    attemptNumber: input.execution.attemptNumber,
  })

  const deadline = computePeriodDeadlineAt(input.execution, periodDurationMs)

  let decisionPreview: ReturnType<typeof resolveBoutDecision> | null = null
  if (
    input.execution.boutPhase === 'pending_confirmation' ||
    input.execution.boutPhase === 'pending_activity_decision' ||
    input.execution.boutPhase === 'confirmed'
  ) {
    decisionPreview = resolveEffectiveBoutDecision({
      events: input.events,
      period: input.execution.currentPeriod,
      attemptNumber: input.execution.attemptNumber,
      participants: input.participants,
    })
  }

  const extraScore =
    input.execution.currentPeriod === 'extra' || decisionPreview?.decidedInPeriod === 'extra'
      ? reduceScoreEvents(input.events, 'extra', input.execution.attemptNumber)
      : null

  const redName =
    input.bout.sideA.kind === 'athlete' ? input.bout.sideA.displayName : 'Красный'
  const blueName =
    input.bout.sideB.kind === 'athlete' ? input.bout.sideB.displayName : 'Синий'

  const fightClockStarted = input.events.some(
    (event) => !event.undoneAt && event.eventType === 'CLOCK_START',
  )

  let proposedVictoryMethod: ReturnType<typeof resolveProposedVictoryMethod> | null = null
  let confirmValidationIssues: ConfirmValidationIssue[] = []
  let confirmGateReason: string | null = null

  if (
    input.execution.boutPhase === 'pending_confirmation' ||
    input.execution.boutPhase === 'pending_activity_decision'
  ) {
    proposedVictoryMethod = resolveProposedVictoryMethod(input.events)
    confirmValidationIssues = validateConfirmBout({
      victoryMethod: proposedVictoryMethod,
      events: input.events,
      attemptNumber: input.execution.attemptNumber,
      period: input.execution.currentPeriod,
    })
    confirmGateReason = getBlockingConfirmIssues(confirmValidationIssues)[0]?.message ?? null
  }

  let confirmationSummary: BoutConfirmationSummary | null = null
  if (
    decisionPreview &&
    (input.execution.boutPhase === 'pending_confirmation' ||
      input.execution.boutPhase === 'pending_activity_decision' ||
      input.execution.boutPhase === 'confirmed')
  ) {
    confirmationSummary = buildBoutConfirmationSummary({
      events: input.events,
      decision: decisionPreview,
      redEntryId: input.participants.redEntryId,
      blueEntryId: input.participants.blueEntryId,
      redName,
      blueName,
      mainRedScore: mainPeriodScore.officialScore.red,
      mainBlueScore: mainPeriodScore.officialScore.blue,
      extraRedScore: extraScore?.officialScore.red ?? null,
      extraBlueScore: extraScore?.officialScore.blue ?? null,
    })
  }

  return {
    boutId: input.bout.id,
    bout: input.bout,
    execution: input.execution,
    participants: input.participants,
    score,
    hints,
    decisionPreview,
    periodDurationMs,
    defaultPeriodDurationMs,
    mainPeriodDurationMs,
    extraPeriodDurationMs,
    periodCount,
    periodRemainingMs: computeRemainingMs(input.execution, periodDurationMs, input.now),
    periodDeadlineAt: deadline?.toISOString() ?? null,
    events: input.events,
    auxiliaryTimers: computeAuxiliaryTimers({
      events: input.events,
      participants: input.participants,
      attemptNumber: input.execution.attemptNumber,
      execution: input.execution,
      now: input.now,
    }),
    correctionMeta: input.correctionMeta,
    confirmationSummary,
    confirmValidationIssues,
    confirmGateReason,
    proposedVictoryMethod,
    fightClockStarted,
    nextSanctions: buildNextSanctions(score),
    undoCandidate: getUndoCandidate({
      execution: input.execution,
      events: input.events,
    }),
  }
}
