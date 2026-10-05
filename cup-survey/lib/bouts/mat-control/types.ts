import type {
  DecisionReason,
  PenaltyLadder,
  PenaltySanction,
  SubmissionSubtype,
  VictoryMethod,
} from '../../config/fseRules'
import type { TechnicalScoreActionId } from '../../config/technicalScoreActions'

export type BoutPhase =
  | 'scheduled'
  | 'live'
  | 'pending_activity_decision'
  | 'pending_confirmation'
  | 'confirmed'

export type ClockState = 'idle' | 'running' | 'stopped'

export type BoutPeriod = 'main' | 'extra'

export type Corner = 'red' | 'blue'

export type TechnicalScoreSource = 'DIRECT' | 'ADJUDICATION'

export type TechnicalScorePayload = {
  source: TechnicalScoreSource
  action?: TechnicalScoreActionId | null
}

export type StoppageTrigger =
  | 'TIME_EXPIRED'
  | 'SUBMISSION'
  | 'CHOKE'
  | 'DISQUALIFICATION'
  | 'NO_SHOW'
  | 'INJURY'
  | 'CLEAR_ADVANTAGE'
  | 'FORFEIT'
  | 'EXTRA_ACTIVITY'
  | 'ACTIVITY_CORRECTION'

export type ControlIntent =
  | 'TECHNICAL_SCORE'
  | 'ADJUDICATION_SCORE'
  | 'PENALTY_GENERAL_NEXT'
  | 'PENALTY_OUT_OF_BOUNDS_NEXT'
  | 'PENALTY_PASSIVITY_NEXT'
  | 'PASSIVITY_APPLY_DUE_PENALTIES'
  | 'PENALTY_DISQUALIFY'
  | 'FIRST_CALL'
  | 'SECONDARY_CALL'
  | 'ATHLETE_WAIT_START'
  | 'ATHLETE_WAIT_END'
  | 'ATHLETE_DOCTOR_START'
  | 'ATHLETE_DOCTOR_END'
  | 'ATHLETE_DOCTOR_REMOVAL'
  | 'ATHLETE_EQUIPMENT_START'
  | 'ATHLETE_EQUIPMENT_END'
  | 'ATHLETE_EQUIPMENT_DISQUALIFY'
  | 'NO_SHOW'
  | 'CORNER_SWAP'
  | 'CLOCK_START'
  | 'CLOCK_STOP'
  | 'CLOCK_ADJUST'
  | 'EXPIRE_PERIOD'
  | 'UNDO'
  | 'FINISH_PERIOD_CORRECTION'
  | 'FINISH_ACTIVITY_CORRECTION'
  | 'STOPPAGE_SUBMISSION'
  | 'STOPPAGE_CHOKE'
  | 'STOPPAGE_CLEAR_ADVANTAGE'
  | 'STOPPAGE_FORFEIT'
  | 'STOPPAGE_INJURY'
  | 'EXTRA_ACTIVITY_DECIDE'
  | 'CORRECT_BEFORE_ACTIVITY'
  | 'CANCEL_STOPPAGE'
  | 'CONFIRM'
  | 'OPEN_NEXT_BOUT'
  | 'POSTPONE'
  | 'PASSIVITY_START'
  | 'PASSIVITY_END'
  | 'RESET_BOUT'
  | 'SET_BOUT_TIMING'

export type BoutReliabilityEnvelope = {
  boutSessionId: string
  clientSessionId: string
  ownershipEpoch: number
  sequenceNo: number
  payloadHash: string
}

export type BoutMutationEnvelope = {
  operationId: string
  holderToken: string
  expectedLiveRevision: number
  expectedAttemptNumber: number
  reliability?: BoutReliabilityEnvelope
}

export type BoutDecision = {
  winnerEntryId: string | null
  loserEntryId: string | null
  reason: DecisionReason
  decidedInPeriod: BoutPeriod
  details?: {
    comparedScoreValue?: 1 | 2 | 3 | 4
    submissionSubtype?: SubmissionSubtype
    redCount?: number
    blueCount?: number
    redPenalties?: number
    bluePenalties?: number
    lastTechnicalCorner?: Corner
    scoreRed?: number
    scoreBlue?: number
    winnerCorner?: Corner
  }
}

export type BoutLiveHints = {
  clearAdvantageEligible: boolean
  leadingCorner?: Corner
  scoreDifference?: number
}

export type BoutEventType =
  | 'TECHNICAL_SCORE'
  | 'PENALTY'
  | 'BOUT_STOPPAGE'
  | 'PASSIVITY_START'
  | 'PASSIVITY_END'
  | 'FIRST_CALL'
  | 'SECONDARY_CALL'
  | 'ATHLETE_WAIT_START'
  | 'ATHLETE_WAIT_END'
  | 'ATHLETE_DOCTOR_START'
  | 'ATHLETE_DOCTOR_END'
  | 'ATHLETE_EQUIPMENT_START'
  | 'ATHLETE_EQUIPMENT_END'
  | 'PERIOD_ENDED'
  | 'CLOCK_START'
  | 'CLOCK_STOP'
  | 'CLOCK_ADJUST'
  | 'CORNER_SWAP'
  | 'ADJUDICATION'
  | 'EXTRA_ACTIVITY_DECISION'
  | 'STOPPAGE_CANCELLED'
  | 'RESULT_CONFIRMED'
  | 'UNDO'

export type BoutEventRecord = {
  id: string
  boutId: string
  clientEventId: string
  sequence: number
  eventStatus?: string | null
  boutSessionId?: string | null
  eventHash?: string | null
  eventType: BoutEventType
  entryId: string | null
  cornerAtEvent: Corner | null
  points: number | null
  episodeId: string | null
  boutElapsedMs: number | null
  period: BoutPeriod
  attemptNumber: number
  payload: Record<string, unknown> | null
  undoneAt: Date | null
  createdAt: Date
}

export type PenaltyEventPayload = {
  sanction: PenaltySanction
  awardedPoints: 0 | 1 | 2 | 3
  ladder: PenaltyLadder
}

export type BoutStoppagePayload = {
  winnerEntryId: string | null
  loserEntryId: string | null
  proposedVictoryMethod: VictoryMethod
  submissionSubtype?: SubmissionSubtype
  proposedDecisionReason?: DecisionReason
  officialEndedAt: string
  boutElapsedMs: number
  period: BoutPeriod
  trigger: StoppageTrigger
  triggerEventId?: string
}

export type MatControlExecution = {
  id: string
  boutId: string
  tournamentScopeId: string
  actualStartAt: Date | null
  actualEndAt: Date | null
  officialStartedAt: Date | null
  officialEndedAt: Date | null
  mainEndedAt: Date | null
  extraEndedAt: Date | null
  activityCorrectionMode: boolean
  periodCorrectionMode: boolean
  attemptNumber: number
  boutPhase: BoutPhase
  clockState: ClockState
  clockStartedAt: Date | null
  clockElapsedBeforeStartMs: number
  currentPeriod: BoutPeriod
  nextEventSequence: number
  liveRevision: number
  liveSnapshot: unknown
  frozenScheduleFormatted?: string | null
  frozenScheduleMatNumber?: number | null
  frozenSchedulePosition?: number | null
}

export type MatControlSessionRecord = {
  tournamentScopeId: string
  matIndex: number
  activeBoutId: string | null
  correctionFocusBoutId: string | null
  revision: number
  holderToken: string | null
  holderSince: Date | null
  heartbeatAt: Date | null
  expiresAt: Date | null
}

export type BoutParticipantContext = {
  redEntryId: string | null
  blueEntryId: string | null
  cornersSwapped: boolean
}

export type MatScheduleEntry = {
  boutId: string
  matIndex: number
}

export type ScoreState = {
  officialScore: { red: number; blue: number }
  technicalScore: { red: number; blue: number }
  periodPenaltyCount: { red: number; blue: number }
  generalDisciplinaryLadder: { red: PenaltySanction | null; blue: PenaltySanction | null }
  outOfBoundsLadder: { red: PenaltySanction | null; blue: PenaltySanction | null }
  passivityLadder: { red: PenaltySanction | null; blue: PenaltySanction | null }
  technicalCounts: {
    red: Record<1 | 2 | 3 | 4, number>
    blue: Record<1 | 2 | 3 | 4, number>
  }
}

export type CommandRouterContext = {
  execution: MatControlExecution
  session: MatControlSessionRecord
  participants: BoutParticipantContext
  events: BoutEventRecord[]
  now: Date
  envelope: BoutMutationEnvelope
  intent: ControlIntent
  payload: Record<string, unknown>
}

export type CommandRouterResult = {
  execution: MatControlExecution
  session: MatControlSessionRecord
  createdEvents: BoutEventRecord[]
  response: Record<string, unknown>
  replay?: boolean
}

export type CancelStoppageMode =
  | 'NO_SHOW_REVERT'
  | 'EARLY_STOPPAGE_REVERT'
  | 'PERIOD_END_CORRECTION'
  | 'ACTIVITY_DECISION_REVERT'
