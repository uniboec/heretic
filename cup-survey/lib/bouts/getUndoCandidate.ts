import { formatTechnicalScoreActionFromPayload } from './presentation/formatTechnicalScoreAction'
import { assertCommandAllowed } from './assertCommandAllowed'
import { assertExtraPeriodUndoTargets, previewUndoTargets } from './compoundUndo'
import type {
  BoutEventRecord,
  BoutEventType,
  Corner,
  MatControlExecution,
  PenaltyEventPayload,
} from './mat-control/types'

export type UndoCandidateSemantic =
  | { kind: 'TECHNICAL_SCORE'; corner: Corner; points: number; actionLabel?: string | null }
  | { kind: 'PENALTY'; corner: Corner; sanction: PenaltyEventPayload['sanction']; ladder: PenaltyEventPayload['ladder'] }
  | { kind: 'ADJUDICATION'; corner: Corner; points: number }
  | { kind: 'CORNER_SWAP' }
  | { kind: 'FIRST_CALL'; corner: Corner }
  | { kind: 'SECONDARY_CALL'; corner: Corner }
  | { kind: 'ATHLETE_WAIT_START'; corner: Corner }
  | { kind: 'ATHLETE_WAIT_END'; corner: Corner; waitedMs: number }
  | { kind: 'ATHLETE_DOCTOR_START'; corner: Corner }
  | { kind: 'ATHLETE_DOCTOR_END'; corner: Corner; totalMs: number }
  | { kind: 'ATHLETE_EQUIPMENT_START'; corner: Corner }
  | { kind: 'ATHLETE_EQUIPMENT_END'; corner: Corner; totalMs: number }
  | { kind: 'CLOCK_ADJUST'; deltaMs: number }
  | { kind: 'COMPOUND'; primaryEventType: BoutEventType }

export type UndoCandidate = {
  targetEventIds: string[]
  targetEpisodeId: string | null
  primaryEventType: BoutEventType
  semantic: UndoCandidateSemantic
}

function buildSemantic(
  primary: BoutEventRecord,
  targets: BoutEventRecord[],
): UndoCandidateSemantic {
  if (targets.length > 1) {
    return { kind: 'COMPOUND', primaryEventType: primary.eventType }
  }

  switch (primary.eventType) {
    case 'TECHNICAL_SCORE':
      return {
        kind: 'TECHNICAL_SCORE',
        corner: primary.cornerAtEvent ?? 'red',
        points: primary.points ?? 0,
        actionLabel: formatTechnicalScoreActionFromPayload(primary.payload),
      }
    case 'PENALTY': {
      const payload = primary.payload as PenaltyEventPayload | null
      return {
        kind: 'PENALTY',
        corner: primary.cornerAtEvent ?? 'red',
        sanction: payload?.sanction ?? 'REMARK',
        ladder: payload?.ladder ?? 'GENERAL',
      }
    }
    case 'ADJUDICATION':
      return {
        kind: 'ADJUDICATION',
        corner: primary.cornerAtEvent ?? 'red',
        points: primary.points ?? 0,
      }
    case 'CORNER_SWAP':
      return { kind: 'CORNER_SWAP' }
    case 'FIRST_CALL':
      return { kind: 'FIRST_CALL', corner: primary.cornerAtEvent ?? 'red' }
    case 'SECONDARY_CALL':
      return { kind: 'SECONDARY_CALL', corner: primary.cornerAtEvent ?? 'red' }
    case 'ATHLETE_WAIT_START':
      return { kind: 'ATHLETE_WAIT_START', corner: primary.cornerAtEvent ?? 'red' }
    case 'ATHLETE_WAIT_END': {
      const payload = primary.payload as { accumulatedMs?: number } | null
      return {
        kind: 'ATHLETE_WAIT_END',
        corner: primary.cornerAtEvent ?? 'red',
        waitedMs: payload?.accumulatedMs ?? 0,
      }
    }
    case 'ATHLETE_DOCTOR_START':
      return { kind: 'ATHLETE_DOCTOR_START', corner: primary.cornerAtEvent ?? 'red' }
    case 'ATHLETE_DOCTOR_END': {
      const payload = primary.payload as { accumulatedMs?: number } | null
      return {
        kind: 'ATHLETE_DOCTOR_END',
        corner: primary.cornerAtEvent ?? 'red',
        totalMs: payload?.accumulatedMs ?? 0,
      }
    }
    case 'ATHLETE_EQUIPMENT_START':
      return { kind: 'ATHLETE_EQUIPMENT_START', corner: primary.cornerAtEvent ?? 'red' }
    case 'ATHLETE_EQUIPMENT_END': {
      const payload = primary.payload as { accumulatedMs?: number } | null
      return {
        kind: 'ATHLETE_EQUIPMENT_END',
        corner: primary.cornerAtEvent ?? 'red',
        totalMs: payload?.accumulatedMs ?? 0,
      }
    }
    case 'CLOCK_ADJUST': {
      const payload = primary.payload as { deltaMs?: number } | null
      return { kind: 'CLOCK_ADJUST', deltaMs: payload?.deltaMs ?? 0 }
    }
    default:
      return { kind: 'COMPOUND', primaryEventType: primary.eventType }
  }
}

export function getUndoCandidate(input: {
  execution: MatControlExecution
  events: BoutEventRecord[]
}): UndoCandidate | null {
  try {
    assertCommandAllowed(input.execution, 'UNDO')
  } catch {
    return null
  }

  const targets = previewUndoTargets({
    events: input.events,
    attemptNumber: input.execution.attemptNumber,
    payload: {},
  })

  if (targets.length === 0) return null

  if (input.execution.activityCorrectionMode) {
    try {
      assertExtraPeriodUndoTargets(targets)
    } catch {
      return null
    }
  }

  const primary = targets[targets.length - 1]!
  return {
    targetEventIds: targets.map((event) => event.id),
    targetEpisodeId: primary.episodeId,
    primaryEventType: primary.eventType,
    semantic: buildSemantic(primary, targets),
  }
}
