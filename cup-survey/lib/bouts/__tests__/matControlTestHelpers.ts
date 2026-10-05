import { randomUUID } from 'node:crypto'
import { routeMatControlCommand } from '../matControlCommandRouter'
import type {
  BoutEventRecord,
  BoutMutationEnvelope,
  ControlIntent,
  Corner,
  MatControlExecution,
  MatControlSessionRecord,
} from '../mat-control/types'

export const defaultParticipants = {
  redEntryId: 'red-1',
  blueEntryId: 'blue-1',
  cornersSwapped: false,
}

export const defaultSession: MatControlSessionRecord = {
  tournamentScopeId: 'cup-2026',
  matIndex: 1,
  activeBoutId: null,
  correctionFocusBoutId: null,
  revision: 0,
  holderToken: 'token',
  holderSince: new Date('2026-09-30T10:00:00.000Z'),
  heartbeatAt: new Date('2026-09-30T10:00:00.000Z'),
  expiresAt: new Date('2026-09-30T10:05:00.000Z'),
}

export function baseExecution(overrides: Partial<MatControlExecution> = {}): MatControlExecution {
  return {
    id: 'exec-1',
    boutId: 'bout-1',
    tournamentScopeId: 'cup-2026',
    actualStartAt: null,
    actualEndAt: null,
    officialStartedAt: null,
    officialEndedAt: null,
    mainEndedAt: null,
    extraEndedAt: null,
    activityCorrectionMode: false,
    periodCorrectionMode: false,
    attemptNumber: 1,
    boutPhase: 'scheduled',
    clockState: 'idle',
    clockStartedAt: null,
    clockElapsedBeforeStartMs: 0,
    currentPeriod: 'main',
    nextEventSequence: 0,
    liveRevision: 0,
    liveSnapshot: null,
    ...overrides,
  }
}

export function applySharedEpisodeTie(
  state: {
    execution: MatControlExecution
    session: MatControlSessionRecord
    events: BoutEventRecord[]
    now?: Date
  },
  redPoints: number,
  bluePoints: number,
  operationId = 'shared-episode-tie',
) {
  const now = state.now ?? new Date('2026-09-30T10:00:00.000Z')
  const episodeId = randomUUID()
  let execution = state.execution
  const createdEvents: BoutEventRecord[] = []

  for (const item of [
    { corner: 'red' as Corner, points: redPoints, entryId: defaultParticipants.redEntryId },
    { corner: 'blue' as Corner, points: bluePoints, entryId: defaultParticipants.blueEntryId },
  ]) {
    const event: BoutEventRecord = {
      id: `evt-${execution.nextEventSequence}`,
      boutId: execution.boutId,
      clientEventId: `${operationId}-${item.corner}`,
      sequence: execution.nextEventSequence,
      eventType: 'TECHNICAL_SCORE',
      entryId: item.entryId,
      cornerAtEvent: item.corner,
      points: item.points,
      episodeId,
      boutElapsedMs: execution.clockElapsedBeforeStartMs,
      period: execution.currentPeriod,
      attemptNumber: execution.attemptNumber,
      payload: { source: 'DIRECT' },
      undoneAt: null,
      createdAt: now,
    }
    execution = { ...execution, nextEventSequence: execution.nextEventSequence + 1 }
    createdEvents.push(event)
  }

  return {
    execution: {
      ...execution,
      boutPhase: 'live',
      clockState: execution.clockState === 'idle' ? 'running' : execution.clockState,
      liveRevision: execution.liveRevision + 1,
    },
    session: state.session,
    events: [...state.events, ...createdEvents],
    createdEvents,
  }
}

export function runMatControlCommand(
  intent: ControlIntent,
  payload: Record<string, unknown>,
  state: {
    execution: MatControlExecution
    session: MatControlSessionRecord
    events: BoutEventRecord[]
    operationId?: string
    now?: Date
  },
) {
  const envelope: BoutMutationEnvelope = {
    operationId: state.operationId ?? `op-${intent}-${state.execution.liveRevision}`,
    holderToken: state.session.holderToken ?? 'token',
    expectedLiveRevision: state.execution.liveRevision,
    expectedAttemptNumber: state.execution.attemptNumber,
  }

  const result = routeMatControlCommand({
    execution: state.execution,
    session: state.session,
    participants: defaultParticipants,
    events: state.events,
    now: state.now ?? new Date('2026-09-30T10:00:00.000Z'),
    envelope,
    intent,
    payload,
  })

  const mergedEvents = result.response.mergedEvents as BoutEventRecord[] | undefined

  return {
    execution: result.execution,
    session: result.session,
    events: mergedEvents ?? [...state.events, ...result.createdEvents],
    createdEvents: result.createdEvents,
    response: result.response,
  }
}
