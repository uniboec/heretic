import type { BoutScheduleExecution, BoutEvent } from '@prisma/client'
import type {
  BoutEventRecord,
  BoutPhase,
  BoutPeriod,
  ClockState,
  Corner,
  MatControlExecution,
} from './mat-control/types'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'

function asBoutPhase(value: string): BoutPhase {
  if (
    value === 'scheduled' ||
    value === 'live' ||
    value === 'pending_activity_decision' ||
    value === 'pending_confirmation' ||
    value === 'confirmed'
  ) {
    return value
  }
  return 'scheduled'
}

function asClockState(value: string): ClockState {
  if (value === 'running' || value === 'stopped') return value
  return 'idle'
}

function asPeriod(value: string): BoutPeriod {
  return value === 'extra' ? 'extra' : 'main'
}

export function mapExecutionRow(row: BoutScheduleExecution): MatControlExecution {
  return {
    id: row.id,
    boutId: row.boutId,
    tournamentScopeId: row.tournamentScopeId,
    actualStartAt: row.actualStartAt,
    actualEndAt: row.actualEndAt,
    officialStartedAt: row.officialStartedAt,
    officialEndedAt: row.officialEndedAt,
    mainEndedAt: row.mainEndedAt,
    extraEndedAt: row.extraEndedAt,
    activityCorrectionMode: row.activityCorrectionMode,
    periodCorrectionMode: row.periodCorrectionMode,
    attemptNumber: row.attemptNumber,
    boutPhase: asBoutPhase(row.boutPhase),
    clockState: asClockState(row.clockState),
    clockStartedAt: row.clockStartedAt,
    clockElapsedBeforeStartMs: row.clockElapsedBeforeStartMs,
    currentPeriod: asPeriod(row.currentPeriod),
    nextEventSequence: row.nextEventSequence,
    liveRevision: row.liveRevision,
    liveSnapshot: row.liveSnapshot,
    frozenScheduleFormatted: row.frozenScheduleFormatted,
    frozenScheduleMatNumber: row.frozenScheduleMatNumber,
    frozenSchedulePosition: row.frozenSchedulePosition,
  }
}

export function mapExecutionToPrismaUpdate(execution: MatControlExecution) {
  return {
    actualStartAt: execution.actualStartAt,
    actualEndAt: execution.actualEndAt,
    officialStartedAt: execution.officialStartedAt,
    officialEndedAt: execution.officialEndedAt,
    mainEndedAt: execution.mainEndedAt,
    extraEndedAt: execution.extraEndedAt,
    activityCorrectionMode: execution.activityCorrectionMode,
    periodCorrectionMode: execution.periodCorrectionMode,
    attemptNumber: execution.attemptNumber,
    boutPhase: execution.boutPhase,
    clockState: execution.clockState,
    clockStartedAt: execution.clockStartedAt,
    clockElapsedBeforeStartMs: execution.clockElapsedBeforeStartMs,
    currentPeriod: execution.currentPeriod,
    nextEventSequence: execution.nextEventSequence,
    liveRevision: execution.liveRevision,
    liveSnapshot: execution.liveSnapshot as object | null,
  }
}

export function mapEventRow(row: BoutEvent): BoutEventRecord {
  return {
    id: row.id,
    boutId: row.boutId,
    clientEventId: row.clientEventId,
    sequence: row.sequence,
    eventStatus: row.eventStatus,
    boutSessionId: row.boutSessionId,
    eventHash: row.eventHash,
    eventType: row.eventType as BoutEventRecord['eventType'],
    entryId: row.entryId,
    cornerAtEvent: row.cornerAtEvent as Corner | null,
    points: row.points,
    episodeId: row.episodeId,
    boutElapsedMs: row.boutElapsedMs,
    period: asPeriod(row.period),
    attemptNumber: row.attemptNumber,
    payload: row.payload as Record<string, unknown> | null,
    undoneAt: row.undoneAt,
    createdAt: row.createdAt,
  }
}

export function createDefaultExecutionData(boutId: string) {
  return {
    boutId,
    tournamentScopeId: TOURNAMENT_SCOPE_ID,
    boutPhase: 'scheduled',
    clockState: 'idle',
    currentPeriod: 'main',
    attemptNumber: 1,
    liveRevision: 0,
    nextEventSequence: 0,
    clockElapsedBeforeStartMs: 0,
    activityCorrectionMode: false,
    periodCorrectionMode: false,
    liveSnapshot: null,
    actualStartAt: null,
    actualEndAt: null,
    officialStartedAt: null,
    officialEndedAt: null,
    mainEndedAt: null,
    extraEndedAt: null,
    clockStartedAt: null,
  }
}
