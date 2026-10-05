import {
  nextSanctionOnLadder,
  type PenaltyLadder,
  type VictoryMethod,
} from '../config/fseRules'
import {
  getTechnicalScoreAction,
  isTechnicalScoreActionId,
} from '../config/technicalScoreActions'
import { assertActiveBout } from './assertActiveBout'
import { assertBoutParticipantCorner, entryIdForCorner, oppositeCorner } from './assertBoutParticipantCorner'
import {
  assertAthleteDoctorPause,
  assertAthleteDoctorStart,
  assertDoctorRemovalAllowed,
  computeActiveAthleteDoctorTotals,
  getDoctorResumeBaselineMs,
  hasActiveAthleteDoctorForEntry,
} from './athleteDoctorVisit'
import {
  assertAthleteEquipmentPause,
  assertAthleteEquipmentStart,
  assertEquipmentDisqualifyAllowed,
  computeActiveAthleteEquipmentTotals,
  getEquipmentResumeBaselineMs,
  hasActiveAthleteEquipmentForEntry,
} from './athleteEquipmentCorrection'
import {
  assertAthleteWaitPause,
  assertAthleteWaitStart,
  buildLateAppearancePenaltyPayloads,
  computeActiveAthleteWaitTotals,
  countLateAppearancePenaltiesInEpisode,
  getResumeBaselineMs,
} from './athleteWait'
import { countLateAppearancePenaltySteps } from './lateAppearancePenalties'
import { applyBoutTimingSettings } from './applyBoutTimingSettings'
import { assertCallOrder } from './assertCallOrder'
import { assertCommandAllowed } from './assertCommandAllowed'
import { cancelBoutStoppage } from './cancelBoutStoppage'
import { pinSessionActiveBoutIfNeeded } from './assertActiveBout'
import { assertConfirmBoutValid } from './confirmValidation'
import { assertDirectTechnicalScoreAllowed } from './directScoreValidation'
import { confirmBoutResult } from './confirmBoutResult'
import { resolveCornersSwappedFromEvents } from './matControlContext'
import { expirePeriod } from './expirePeriod'
import { finishActivityScoreCorrection } from './finishActivityScoreCorrection'
import { finishPeriodCorrection } from './finishPeriodCorrection'
import {
  AttemptMismatchError,
  CommandNotAllowedError,
  DisqualificationConfirmationRequiredError,
  StaleLiveRevisionError,
} from './mat-control/errors'
import type {
  BoutEventRecord,
  CommandRouterContext,
  CommandRouterResult,
  ControlIntent,
  Corner,
  MatControlExecution,
  PenaltyEventPayload,
} from './mat-control/types'
import { recordBoutStoppage } from './recordBoutStoppage'
import {
  buildPenaltyEventPayload,
  reduceScoreEvents,
  resolveBoutDecision,
  resolveEffectiveBoutDecision,
} from './scoreEngine'
import { applyCompoundUndo, assertExtraPeriodUndoTargets, previewUndoTargets } from './compoundUndo'
import { closeOpenAuxiliaryEvents } from './closeOpenAuxiliaryEvents'
import { resolvePassivityDuePenaltyPayloads } from './passivityPenalties'
import { resetBoutExecutionForRerun } from './resetBoutExecutionForRerun'
import {
  adjustClockElapsed,
  computeClockElapsedMs,
  revertUndoneClockAdjusts,
  startClockAt,
  stopClockAt,
} from './stopClockAt'

function bumpRevision(execution: MatControlExecution): MatControlExecution {
  return { ...execution, liveRevision: execution.liveRevision + 1 }
}

function assertRevisionGuards(
  execution: MatControlExecution,
  envelope: CommandRouterContext['envelope'],
): void {
  if (execution.attemptNumber !== envelope.expectedAttemptNumber) {
    throw new AttemptMismatchError()
  }
  if (execution.liveRevision !== envelope.expectedLiveRevision) {
    throw new StaleLiveRevisionError()
  }
}

function nextEvent(
  execution: MatControlExecution,
  partial: Omit<BoutEventRecord, 'id' | 'boutId' | 'sequence' | 'attemptNumber' | 'undoneAt' | 'createdAt'>,
  now: Date,
): { execution: MatControlExecution; event: BoutEventRecord } {
  const event: BoutEventRecord = {
    id: `evt-${execution.nextEventSequence}`,
    boutId: execution.boutId,
    sequence: execution.nextEventSequence,
    attemptNumber: execution.attemptNumber,
    undoneAt: null,
    createdAt: now,
    ...partial,
    boutElapsedMs: computeClockElapsedMs(execution, now),
  }

  return {
    execution: { ...execution, nextEventSequence: execution.nextEventSequence + 1 },
    event,
  }
}

function derivePenalty(input: {
  intent: Extract<
    ControlIntent,
    | 'PENALTY_GENERAL_NEXT'
    | 'PENALTY_OUT_OF_BOUNDS_NEXT'
    | 'PENALTY_PASSIVITY_NEXT'
    | 'PENALTY_DISQUALIFY'
  >
  corner: Corner
  events: BoutEventRecord[]
  attemptNumber: number
  period: MatControlExecution['currentPeriod']
  disqualifyLadder?: PenaltyLadder
}): PenaltyEventPayload {
  const ladder =
    input.intent === 'PENALTY_OUT_OF_BOUNDS_NEXT'
      ? 'OUT_OF_BOUNDS'
      : input.intent === 'PENALTY_PASSIVITY_NEXT'
        ? 'PASSIVITY'
        : input.intent === 'PENALTY_DISQUALIFY'
          ? input.disqualifyLadder ?? 'GENERAL'
          : 'GENERAL'

  if (input.intent === 'PENALTY_DISQUALIFY') {
    if (!input.disqualifyLadder) {
      throw new Error('PENALTY_DISQUALIFY requires payload.ladder')
    }
    return buildPenaltyEventPayload({ ladder: input.disqualifyLadder, sanction: 'DISQUALIFICATION' })
  }

  const state = reduceScoreEvents(input.events, input.period, input.attemptNumber)
  const currentStep =
    ladder === 'GENERAL'
      ? state.generalDisciplinaryLadder[input.corner]
      : ladder === 'OUT_OF_BOUNDS'
        ? state.outOfBoundsLadder[input.corner]
        : state.passivityLadder[input.corner]

  const nextSanction = nextSanctionOnLadder(ladder, currentStep)
  if (nextSanction === 'DISQUALIFICATION') {
    throw new DisqualificationConfirmationRequiredError()
  }

  return buildPenaltyEventPayload({ ladder, sanction: nextSanction })
}

function applyScoringIntent(ctx: CommandRouterContext): CommandRouterResult {
  const corner = ctx.payload.corner as Corner
  const entryId = ctx.payload.entryId as string
  assertBoutParticipantCorner({ entryId, corner, participants: ctx.participants })

  const points = ctx.payload.points as number
  const action = ctx.payload.action
  if (action != null) {
    if (!isTechnicalScoreActionId(action)) {
      throw new CommandNotAllowedError('Неизвестное техническое действие')
    }
    const definition = getTechnicalScoreAction(action)
    if (definition.points !== points) {
      throw new CommandNotAllowedError('Техническое действие не соответствует количеству баллов')
    }
  }

  assertDirectTechnicalScoreAllowed({
    events: ctx.events,
    attemptNumber: ctx.execution.attemptNumber,
    points,
    payload: {
      source: 'DIRECT',
      adminOverrideReason: ctx.payload.adminOverrideReason as string | undefined,
      ...(action != null ? { action } : {}),
    },
  })

  const episodeId = crypto.randomUUID()
  const { execution, event } = nextEvent(
    ctx.execution,
    {
      clientEventId: ctx.envelope.operationId,
      eventType: 'TECHNICAL_SCORE',
      entryId,
      cornerAtEvent: corner,
      points,
      episodeId,
      boutElapsedMs: ctx.execution.clockElapsedBeforeStartMs,
      period: ctx.execution.currentPeriod,
      payload: {
        source: 'DIRECT',
        ...(ctx.payload.adminOverrideReason
          ? { adminOverrideReason: ctx.payload.adminOverrideReason }
          : {}),
        ...(action != null ? { action } : {}),
      },
    },
    ctx.now,
  )

  return {
    execution: bumpRevision(execution),
    session: ctx.session,
    createdEvents: [event],
    response: { ok: true, liveRevision: execution.liveRevision + 1 },
  }
}

function applyPenaltyIntent(ctx: CommandRouterContext): CommandRouterResult {
  const corner = ctx.payload.corner as Corner
  const entryId = ctx.payload.entryId as string
  assertBoutParticipantCorner({ entryId, corner, participants: ctx.participants })

  const disqualifyLadder =
    ctx.intent === 'PENALTY_DISQUALIFY'
      ? (ctx.payload.ladder as PenaltyLadder | undefined)
      : undefined

  const penaltyPayload = derivePenalty({
    intent: ctx.intent as Extract<
      ControlIntent,
      | 'PENALTY_GENERAL_NEXT'
      | 'PENALTY_OUT_OF_BOUNDS_NEXT'
      | 'PENALTY_PASSIVITY_NEXT'
      | 'PENALTY_DISQUALIFY'
    >,
    corner,
    events: ctx.events,
    attemptNumber: ctx.execution.attemptNumber,
    period: ctx.execution.currentPeriod,
    disqualifyLadder,
  })

  const { execution: afterPenaltyEvent, event: penaltyEvent } = nextEvent(
    ctx.execution,
    {
      clientEventId: ctx.envelope.operationId,
      eventType: 'PENALTY',
      entryId,
      cornerAtEvent: corner,
      points: penaltyPayload.awardedPoints,
      episodeId: null,
      boutElapsedMs: ctx.execution.clockElapsedBeforeStartMs,
      period: ctx.execution.currentPeriod,
      payload: penaltyPayload,
    },
    ctx.now,
  )

  let execution = afterPenaltyEvent
  const createdEvents: BoutEventRecord[] = [penaltyEvent]

  if (penaltyPayload.sanction === 'DISQUALIFICATION') {
    const winnerCorner = oppositeCorner(corner)
    const winnerEntryId = entryIdForCorner(winnerCorner, ctx.participants)
    const loserEntryId = entryId
    const decision = {
      winnerEntryId,
      loserEntryId,
      reason: 'DISQUALIFICATION' as const,
      decidedInPeriod: execution.currentPeriod,
    }

    const stoppage = recordBoutStoppage({
      execution,
      events: [...ctx.events, penaltyEvent],
      participants: ctx.participants,
      decision,
      trigger: 'DISQUALIFICATION',
      victoryMethod: 'DISQUALIFICATION',
      now: ctx.now,
      triggerEventId: penaltyEvent.id,
    })
    execution = stoppage.execution
    createdEvents.push(...stoppage.auxiliaryCloseEvents, stoppage.stoppageEvent)
  }

  return {
    execution: bumpRevision(execution),
    session: ctx.session,
    createdEvents,
    response: { ok: true, liveRevision: execution.liveRevision + 1 },
  }
}

function applyPassivityDuePenalties(ctx: CommandRouterContext): CommandRouterResult {
  const corner = ctx.payload.corner as Corner
  const entryId = ctx.payload.entryId as string
  assertBoutParticipantCorner({ entryId, corner, participants: ctx.participants })

  const { payloads: penaltyPayloads, disqualificationDue } = resolvePassivityDuePenaltyPayloads({
    events: ctx.events,
    corner,
    entryId,
    attemptNumber: ctx.execution.attemptNumber,
    period: ctx.execution.currentPeriod,
    execution: ctx.execution,
    now: ctx.now,
  })

  let execution = ctx.execution
  const createdEvents: BoutEventRecord[] = []
  const rollingEvents = [...ctx.events]

  for (const [index, penaltyPayload] of penaltyPayloads.entries()) {
    const penaltyResult = nextEvent(
      execution,
      {
        clientEventId: `${ctx.envelope.operationId}:passivity-penalty:${index}`,
        eventType: 'PENALTY',
        entryId,
        cornerAtEvent: corner,
        points: penaltyPayload.awardedPoints,
        episodeId: null,
        boutElapsedMs: computeClockElapsedMs(execution, ctx.now),
        period: execution.currentPeriod,
        payload: penaltyPayload,
      },
      ctx.now,
    )
    execution = penaltyResult.execution
    createdEvents.push(penaltyResult.event)
    rollingEvents.push(penaltyResult.event)
  }

  return {
    execution: bumpRevision(execution),
    session: ctx.session,
    createdEvents,
    response: {
      ok: true,
      liveRevision: execution.liveRevision + 1,
      disqualificationDue,
    },
  }
}

function tryIdempotentExpirePeriod(ctx: CommandRouterContext): CommandRouterResult | null {
  if (ctx.intent !== 'EXPIRE_PERIOD') {
    return null
  }

  const period = ctx.payload.period as MatControlExecution['currentPeriod']
  const alreadyEnded =
    (period === 'main' && ctx.execution.mainEndedAt != null) ||
    (period === 'extra' && ctx.execution.extraEndedAt != null)

  if (!alreadyEnded) {
    return null
  }

  return {
    execution: ctx.execution,
    session: ctx.session,
    createdEvents: [],
    response: {
      ok: true,
      liveRevision: ctx.execution.liveRevision,
      alreadyProcessed: true,
    },
  }
}

export function applyMatControlIntent(ctx: CommandRouterContext): CommandRouterResult {
  const idempotentExpire = tryIdempotentExpirePeriod(ctx)
  if (idempotentExpire) {
    return idempotentExpire
  }

  assertRevisionGuards(ctx.execution, ctx.envelope)
  assertCommandAllowed(ctx.execution, ctx.intent)
  assertActiveBout({
    session: ctx.session,
    boutId: ctx.execution.boutId,
    intent: ctx.intent,
    execution: ctx.execution,
    boutInMatQueue: true,
  })

  switch (ctx.intent) {
    case 'ATHLETE_WAIT_START':
    case 'ATHLETE_WAIT_END': {
      const entryId = ctx.payload.entryId as string
      const corner = ctx.payload.corner as Corner
      const attemptNumber = ctx.execution.attemptNumber
      assertBoutParticipantCorner({ entryId, corner, participants: ctx.participants })

      if (ctx.intent === 'ATHLETE_WAIT_START') {
        assertAthleteWaitStart({ entryId, events: ctx.events, attemptNumber })
        const accumulatedMs = getResumeBaselineMs(ctx.events, entryId, attemptNumber)
        const { execution, event } = nextEvent(
          ctx.execution,
          {
            clientEventId: ctx.envelope.operationId,
            eventType: 'ATHLETE_WAIT_START',
            entryId,
            cornerAtEvent: corner,
            points: null,
            episodeId: null,
            boutElapsedMs: ctx.execution.clockElapsedBeforeStartMs,
            period: ctx.execution.currentPeriod,
            payload: { accumulatedMs },
          },
          ctx.now,
        )
        return {
          execution: bumpRevision(execution),
          session: ctx.session,
          createdEvents: [event],
          response: { ok: true, liveRevision: execution.liveRevision + 1 },
        }
      }

      assertAthleteWaitPause({ entryId, events: ctx.events, attemptNumber })
      const { accumulatedMs, sessionMs, totalMs } = computeActiveAthleteWaitTotals({
        events: ctx.events,
        entryId,
        now: ctx.now,
        attemptNumber,
      })
      const totalPenaltySteps = countLateAppearancePenaltySteps(totalMs)
      const priorPenaltySteps = countLateAppearancePenaltiesInEpisode({
        events: ctx.events,
        entryId,
        attemptNumber,
      })
      const penaltyStepsToApply = Math.max(0, totalPenaltySteps - priorPenaltySteps)
      const penaltyPayloads = buildLateAppearancePenaltyPayloads({
        events: ctx.events,
        corner,
        period: ctx.execution.currentPeriod,
        attemptNumber: ctx.execution.attemptNumber,
        waitedMs: totalMs,
        stepsToApply: penaltyStepsToApply,
      })

      let execution = ctx.execution
      const createdEvents: BoutEventRecord[] = []
      const rollingEvents = [...ctx.events]

      const waitEndResult = nextEvent(
        execution,
        {
          clientEventId: ctx.envelope.operationId,
          eventType: 'ATHLETE_WAIT_END',
          entryId,
          cornerAtEvent: corner,
          points: null,
          episodeId: null,
          boutElapsedMs: execution.clockElapsedBeforeStartMs,
          period: execution.currentPeriod,
          payload: {
            accumulatedMs: totalMs,
            sessionMs,
            penaltyStepsApplied: priorPenaltySteps + penaltyPayloads.length,
          },
        },
        ctx.now,
      )
      execution = waitEndResult.execution
      createdEvents.push(waitEndResult.event)
      rollingEvents.push(waitEndResult.event)

      for (const [index, penaltyPayload] of penaltyPayloads.entries()) {
        const penaltyResult = nextEvent(
          execution,
          {
            clientEventId: `${ctx.envelope.operationId}:penalty:${index}`,
            eventType: 'PENALTY',
            entryId,
            cornerAtEvent: corner,
            points: penaltyPayload.awardedPoints,
            episodeId: null,
            boutElapsedMs: execution.clockElapsedBeforeStartMs,
            period: execution.currentPeriod,
            payload: penaltyPayload,
          },
          ctx.now,
        )
        execution = penaltyResult.execution
        createdEvents.push(penaltyResult.event)
        rollingEvents.push(penaltyResult.event)
      }

      return {
        execution: bumpRevision(execution),
        session: ctx.session,
        createdEvents,
        response: { ok: true, liveRevision: execution.liveRevision + 1 },
      }
    }

    case 'ATHLETE_DOCTOR_START':
    case 'ATHLETE_DOCTOR_END':
    case 'ATHLETE_DOCTOR_REMOVAL': {
      const entryId = ctx.payload.entryId as string
      const corner = ctx.payload.corner as Corner
      const attemptNumber = ctx.execution.attemptNumber
      assertBoutParticipantCorner({ entryId, corner, participants: ctx.participants })

      if (ctx.intent === 'ATHLETE_DOCTOR_START') {
        assertAthleteDoctorStart({ entryId, events: ctx.events, attemptNumber })
        const accumulatedMs = getDoctorResumeBaselineMs(ctx.events, entryId, attemptNumber)
        const { execution, event } = nextEvent(
          ctx.execution,
          {
            clientEventId: ctx.envelope.operationId,
            eventType: 'ATHLETE_DOCTOR_START',
            entryId,
            cornerAtEvent: corner,
            points: null,
            episodeId: null,
            boutElapsedMs: ctx.execution.clockElapsedBeforeStartMs,
            period: ctx.execution.currentPeriod,
            payload: { accumulatedMs },
          },
          ctx.now,
        )
        return {
          execution: bumpRevision(execution),
          session: ctx.session,
          createdEvents: [event],
          response: { ok: true, liveRevision: execution.liveRevision + 1 },
        }
      }

      if (ctx.intent === 'ATHLETE_DOCTOR_END') {
        assertAthleteDoctorPause({ entryId, events: ctx.events, attemptNumber })
        const { sessionMs, totalMs } = computeActiveAthleteDoctorTotals({
          events: ctx.events,
          entryId,
          now: ctx.now,
          attemptNumber,
        })
        const { execution, event } = nextEvent(
          ctx.execution,
          {
            clientEventId: ctx.envelope.operationId,
            eventType: 'ATHLETE_DOCTOR_END',
            entryId,
            cornerAtEvent: corner,
            points: null,
            episodeId: null,
            boutElapsedMs: ctx.execution.clockElapsedBeforeStartMs,
            period: ctx.execution.currentPeriod,
            payload: { accumulatedMs: totalMs, sessionMs },
          },
          ctx.now,
        )
        return {
          execution: bumpRevision(execution),
          session: ctx.session,
          createdEvents: [event],
          response: { ok: true, liveRevision: execution.liveRevision + 1 },
        }
      }

      assertDoctorRemovalAllowed({
        entryId,
        events: ctx.events,
        now: ctx.now,
        attemptNumber,
      })
      let execution = ctx.execution
      const createdEvents: BoutEventRecord[] = []

      if (hasActiveAthleteDoctorForEntry(ctx.events, entryId, attemptNumber)) {
        const { sessionMs, totalMs } = computeActiveAthleteDoctorTotals({
          events: ctx.events,
          entryId,
          now: ctx.now,
          attemptNumber,
        })
        const closed = nextEvent(
          execution,
          {
            clientEventId: `${ctx.envelope.operationId}:doctor-close`,
            eventType: 'ATHLETE_DOCTOR_END',
            entryId,
            cornerAtEvent: corner,
            points: null,
            episodeId: null,
            boutElapsedMs: execution.clockElapsedBeforeStartMs,
            period: execution.currentPeriod,
            payload: { accumulatedMs: totalMs, sessionMs },
          },
          ctx.now,
        )
        execution = closed.execution
        createdEvents.push(closed.event)
      }

      const stoppage = recordBoutStoppage({
        execution,
        events: [...ctx.events, ...createdEvents],
        participants: ctx.participants,
        decision: {
          winnerEntryId: entryIdForCorner(oppositeCorner(corner), ctx.participants),
          loserEntryId: entryId,
          reason: 'INJURY',
          decidedInPeriod: execution.currentPeriod,
        },
        trigger: 'INJURY',
        victoryMethod: 'INJURY',
        now: ctx.now,
      })

      return {
        execution: bumpRevision(stoppage.execution),
        session: { ...ctx.session, activeBoutId: ctx.execution.boutId },
        createdEvents: [
          ...createdEvents,
          ...stoppage.auxiliaryCloseEvents,
          stoppage.stoppageEvent,
        ],
        response: { ok: true, liveRevision: stoppage.execution.liveRevision + 1 },
      }
    }

    case 'ATHLETE_EQUIPMENT_START':
    case 'ATHLETE_EQUIPMENT_END':
    case 'ATHLETE_EQUIPMENT_DISQUALIFY': {
      const entryId = ctx.payload.entryId as string
      const corner = ctx.payload.corner as Corner
      const attemptNumber = ctx.execution.attemptNumber
      assertBoutParticipantCorner({ entryId, corner, participants: ctx.participants })

      if (ctx.intent === 'ATHLETE_EQUIPMENT_START') {
        assertAthleteEquipmentStart({ entryId, events: ctx.events, attemptNumber })
        const accumulatedMs = getEquipmentResumeBaselineMs(ctx.events, entryId, attemptNumber)
        const { execution, event } = nextEvent(
          ctx.execution,
          {
            clientEventId: ctx.envelope.operationId,
            eventType: 'ATHLETE_EQUIPMENT_START',
            entryId,
            cornerAtEvent: corner,
            points: null,
            episodeId: null,
            boutElapsedMs: ctx.execution.clockElapsedBeforeStartMs,
            period: ctx.execution.currentPeriod,
            payload: { accumulatedMs },
          },
          ctx.now,
        )
        return {
          execution: bumpRevision(execution),
          session: ctx.session,
          createdEvents: [event],
          response: { ok: true, liveRevision: execution.liveRevision + 1 },
        }
      }

      if (ctx.intent === 'ATHLETE_EQUIPMENT_END') {
        assertAthleteEquipmentPause({ entryId, events: ctx.events, attemptNumber })
        const { sessionMs, totalMs } = computeActiveAthleteEquipmentTotals({
          events: ctx.events,
          entryId,
          now: ctx.now,
          attemptNumber,
        })
        const { execution, event } = nextEvent(
          ctx.execution,
          {
            clientEventId: ctx.envelope.operationId,
            eventType: 'ATHLETE_EQUIPMENT_END',
            entryId,
            cornerAtEvent: corner,
            points: null,
            episodeId: null,
            boutElapsedMs: ctx.execution.clockElapsedBeforeStartMs,
            period: ctx.execution.currentPeriod,
            payload: { accumulatedMs: totalMs, sessionMs },
          },
          ctx.now,
        )
        return {
          execution: bumpRevision(execution),
          session: ctx.session,
          createdEvents: [event],
          response: { ok: true, liveRevision: execution.liveRevision + 1 },
        }
      }

      assertEquipmentDisqualifyAllowed({
        entryId,
        events: ctx.events,
        now: ctx.now,
        attemptNumber,
      })
      let execution = ctx.execution
      const createdEvents: BoutEventRecord[] = []

      if (hasActiveAthleteEquipmentForEntry(ctx.events, entryId, attemptNumber)) {
        const { sessionMs, totalMs } = computeActiveAthleteEquipmentTotals({
          events: ctx.events,
          entryId,
          now: ctx.now,
          attemptNumber,
        })
        const closed = nextEvent(
          execution,
          {
            clientEventId: `${ctx.envelope.operationId}:equipment-close`,
            eventType: 'ATHLETE_EQUIPMENT_END',
            entryId,
            cornerAtEvent: corner,
            points: null,
            episodeId: null,
            boutElapsedMs: execution.clockElapsedBeforeStartMs,
            period: execution.currentPeriod,
            payload: { accumulatedMs: totalMs, sessionMs },
          },
          ctx.now,
        )
        execution = closed.execution
        createdEvents.push(closed.event)
      }

      const stoppage = recordBoutStoppage({
        execution,
        events: [...ctx.events, ...createdEvents],
        participants: ctx.participants,
        decision: {
          winnerEntryId: entryIdForCorner(oppositeCorner(corner), ctx.participants),
          loserEntryId: entryId,
          reason: 'DISQUALIFICATION',
          decidedInPeriod: execution.currentPeriod,
        },
        trigger: 'DISQUALIFICATION',
        victoryMethod: 'DISQUALIFICATION',
        now: ctx.now,
      })

      return {
        execution: bumpRevision(stoppage.execution),
        session: { ...ctx.session, activeBoutId: ctx.execution.boutId },
        createdEvents: [
          ...createdEvents,
          ...stoppage.auxiliaryCloseEvents,
          stoppage.stoppageEvent,
        ],
        response: { ok: true, liveRevision: stoppage.execution.liveRevision + 1 },
      }
    }

    case 'FIRST_CALL':
    case 'SECONDARY_CALL':
    case 'NO_SHOW':
    case 'CORNER_SWAP': {
      assertCallOrder({
        intent: ctx.intent,
        entryId: ctx.payload.entryId as string | undefined,
        corner: ctx.payload.corner as Corner | undefined,
        events: ctx.events,
        participants: ctx.participants,
        now: ctx.now,
        attemptNumber: ctx.execution.attemptNumber,
      })

      if (ctx.intent === 'CORNER_SWAP') {
        const execution = bumpRevision({
          ...ctx.execution,
          liveSnapshot: {
            ...(typeof ctx.execution.liveSnapshot === 'object' && ctx.execution.liveSnapshot
              ? (ctx.execution.liveSnapshot as Record<string, unknown>)
              : {}),
            cornersSwapped: !ctx.participants.cornersSwapped,
          },
        })
        const { execution: afterEvent, event } = nextEvent(
          execution,
          {
            clientEventId: ctx.envelope.operationId,
            eventType: 'CORNER_SWAP',
            entryId: null,
            cornerAtEvent: null,
            points: null,
            episodeId: null,
            boutElapsedMs: ctx.execution.clockElapsedBeforeStartMs,
            period: ctx.execution.currentPeriod,
            payload: { cornersSwapped: !ctx.participants.cornersSwapped },
          },
          ctx.now,
        )
        return {
          execution: afterEvent,
          session: ctx.session,
          createdEvents: [event],
          response: { ok: true, liveRevision: afterEvent.liveRevision },
        }
      }

      if (ctx.intent === 'NO_SHOW') {
        const entryId = ctx.payload.entryId as string
        const corner = ctx.payload.corner as Corner
        const loserEntryId = entryId
        const winnerEntryId = entryIdForCorner(oppositeCorner(corner), ctx.participants)
        const stoppage = recordBoutStoppage({
          execution: ctx.execution,
          events: ctx.events,
          participants: ctx.participants,
          decision: {
            winnerEntryId,
            loserEntryId,
            reason: 'NO_SHOW',
            decidedInPeriod: 'main',
          },
          trigger: 'NO_SHOW',
          victoryMethod: 'NO_SHOW',
          now: ctx.now,
        })

        return {
          execution: bumpRevision(stoppage.execution),
          session: { ...ctx.session, activeBoutId: ctx.execution.boutId },
          createdEvents: [...stoppage.auxiliaryCloseEvents, stoppage.stoppageEvent],
          response: { ok: true, liveRevision: stoppage.execution.liveRevision + 1 },
        }
      }

      const callType = ctx.intent
      const { execution, event } = nextEvent(
        ctx.execution,
        {
          clientEventId: ctx.envelope.operationId,
          eventType: callType,
          entryId: ctx.payload.entryId as string,
          cornerAtEvent: ctx.payload.corner as Corner,
          points: null,
          episodeId: null,
          boutElapsedMs: ctx.execution.clockElapsedBeforeStartMs,
          period: ctx.execution.currentPeriod,
          payload: null,
        },
        ctx.now,
      )

      return {
        execution: bumpRevision(execution),
        session: ctx.session,
        createdEvents: [event],
        response: { ok: true, liveRevision: execution.liveRevision + 1 },
      }
    }

    case 'CLOCK_START': {
      let execution = ctx.execution
      if (execution.boutPhase === 'scheduled') {
        execution = {
          ...execution,
          boutPhase: 'live',
          officialStartedAt: execution.officialStartedAt ?? ctx.now,
          actualStartAt: execution.actualStartAt ?? ctx.now,
        }
      }
      execution = startClockAt(execution, ctx.now)
      const { execution: afterEvent, event } = nextEvent(
        execution,
        {
          clientEventId: ctx.envelope.operationId,
          eventType: 'CLOCK_START',
          entryId: null,
          cornerAtEvent: null,
          points: null,
          episodeId: null,
          boutElapsedMs: execution.clockElapsedBeforeStartMs,
          period: execution.currentPeriod,
          payload: null,
        },
        ctx.now,
      )

      return {
        execution: bumpRevision(afterEvent),
        session: { ...ctx.session, activeBoutId: ctx.execution.boutId },
        createdEvents: [event],
        response: { ok: true, liveRevision: afterEvent.liveRevision + 1 },
      }
    }

    case 'CLOCK_STOP': {
      const stopped = stopClockAt(ctx.execution, ctx.now)
      const { execution, event } = nextEvent(
        stopped,
        {
          clientEventId: ctx.envelope.operationId,
          eventType: 'CLOCK_STOP',
          entryId: null,
          cornerAtEvent: null,
          points: null,
          episodeId: null,
          boutElapsedMs: stopped.clockElapsedBeforeStartMs,
          period: stopped.currentPeriod,
          payload: null,
        },
        ctx.now,
      )
      return {
        execution: bumpRevision(execution),
        session: ctx.session,
        createdEvents: [event],
        response: { ok: true, liveRevision: execution.liveRevision + 1 },
      }
    }

    case 'SET_BOUT_TIMING': {
      const execution = bumpRevision(
        applyBoutTimingSettings({
          execution: ctx.execution,
          payload: {
            mainDurationMs: ctx.payload.mainDurationMs as number | undefined,
            extraDurationMs: ctx.payload.extraDurationMs as number | undefined,
            periodCount: ctx.payload.periodCount as 1 | 2 | undefined,
          },
          now: ctx.now,
        }),
      )
      return {
        execution,
        session: ctx.session,
        createdEvents: [],
        response: { ok: true, liveRevision: execution.liveRevision },
      }
    }

    case 'CLOCK_ADJUST': {
      const periodDurationMs = ctx.payload.periodDurationMs as number
      const deltaMs = ctx.payload.deltaMs as number
      const execution = bumpRevision(
        adjustClockElapsed(ctx.execution, deltaMs, periodDurationMs),
      )
      const { execution: afterEvent, event } = nextEvent(
        execution,
        {
          clientEventId: ctx.envelope.operationId,
          eventType: 'CLOCK_ADJUST',
          entryId: null,
          cornerAtEvent: null,
          points: null,
          episodeId: null,
          boutElapsedMs: execution.clockElapsedBeforeStartMs,
          period: execution.currentPeriod,
          payload: { deltaMs },
        },
        ctx.now,
      )
      return {
        execution: afterEvent,
        session: ctx.session,
        createdEvents: [event],
        response: { ok: true, liveRevision: afterEvent.liveRevision },
      }
    }

    case 'EXPIRE_PERIOD': {
      const period = ctx.payload.period as MatControlExecution['currentPeriod']
      const periodDurationMs = ctx.payload.periodDurationMs as number
      const result = expirePeriod({
        execution: ctx.execution,
        events: ctx.events,
        participants: ctx.participants,
        period,
        periodDurationMs,
        now: ctx.now,
      })

      return {
        execution: result.alreadyProcessed ? result.execution : bumpRevision(result.execution),
        session: ctx.session,
        createdEvents: result.createdEvents,
        response: {
          ok: true,
          liveRevision: result.alreadyProcessed
            ? result.execution.liveRevision
            : result.execution.liveRevision + 1,
          alreadyProcessed: result.alreadyProcessed,
        },
      }
    }

    case 'TECHNICAL_SCORE':
      return applyScoringIntent(ctx)

    case 'PENALTY_GENERAL_NEXT':
    case 'PENALTY_OUT_OF_BOUNDS_NEXT':
    case 'PENALTY_PASSIVITY_NEXT':
    case 'PENALTY_DISQUALIFY':
      return applyPenaltyIntent(ctx)

    case 'PASSIVITY_APPLY_DUE_PENALTIES':
      return applyPassivityDuePenalties(ctx)

    case 'FINISH_PERIOD_CORRECTION': {
      const result = finishPeriodCorrection({
        execution: ctx.execution,
        events: ctx.events,
        participants: ctx.participants,
        now: ctx.now,
      })
      const createdEvents = result.stoppageEvent
        ? [...(result.auxiliaryCloseEvents ?? []), result.stoppageEvent]
        : []
      return {
        execution: bumpRevision(result.execution),
        session: ctx.session,
        createdEvents,
        response: { ok: true, liveRevision: result.execution.liveRevision + 1 },
      }
    }

    case 'FINISH_ACTIVITY_CORRECTION': {
      const result = finishActivityScoreCorrection({
        execution: ctx.execution,
        events: ctx.events,
        participants: ctx.participants,
        now: ctx.now,
      })
      const createdEvents = result.stoppageEvent
        ? [...(result.auxiliaryCloseEvents ?? []), result.stoppageEvent]
        : []
      return {
        execution: bumpRevision(result.execution),
        session: ctx.session,
        createdEvents,
        response: {
          ok: true,
          liveRevision: result.execution.liveRevision + 1,
          boutPhase: result.execution.boutPhase,
        },
      }
    }

    case 'CANCEL_STOPPAGE': {
      const stoppageEvent = [...ctx.events]
        .reverse()
        .find((event) => !event.undoneAt && event.eventType === 'BOUT_STOPPAGE')
      if (!stoppageEvent) {
        throw new Error('BOUT_STOPPAGE not found')
      }
      const result = cancelBoutStoppage({
        execution: ctx.execution,
        session: ctx.session,
        stoppageEvent,
        now: ctx.now,
      })
      let execution = bumpRevision(result.execution)
      let createdEvents: BoutEventRecord[] = []

      if (result.mode === 'NO_SHOW_REVERT') {
        const closed = closeOpenAuxiliaryEvents({
          execution,
          events: ctx.events,
          operationId: ctx.envelope.operationId,
          now: ctx.now,
        })
        execution = closed.execution
        createdEvents = closed.createdEvents
      }

      return {
        execution,
        session: result.session,
        createdEvents,
        response: { ok: true, mode: result.mode, liveRevision: execution.liveRevision + 1 },
      }
    }

    case 'CONFIRM': {
      const latestStoppage = [...ctx.events]
        .reverse()
        .find((event) => !event.undoneAt && event.eventType === 'BOUT_STOPPAGE')
      const payload = latestStoppage?.payload as
        | {
            proposedVictoryMethod?: VictoryMethod
          }
        | undefined
      const decision = resolveEffectiveBoutDecision({
        events: ctx.events,
        period: ctx.execution.currentPeriod,
        attemptNumber: ctx.execution.attemptNumber,
        participants: ctx.participants,
      })
      const victoryMethod = payload?.proposedVictoryMethod ?? 'POINTS'
      assertConfirmBoutValid({
        victoryMethod,
        events: ctx.events,
        attemptNumber: ctx.execution.attemptNumber,
        period: ctx.execution.currentPeriod,
        injuryScoreAcknowledged: ctx.payload?.injuryScoreAcknowledged === true,
      })
      const result = confirmBoutResult({
        execution: ctx.execution,
        session: ctx.session,
        decision,
        victoryMethod,
        now: ctx.now,
        confirmedBy: ctx.payload?.confirmedBy as string | undefined,
      })
      return {
        execution: bumpRevision(result.execution),
        session: result.session,
        createdEvents: [],
        response: {
          ok: true,
          result: result.resultPayload,
          liveRevision: result.execution.liveRevision + 1,
        },
      }
    }

    case 'ADJUDICATION_SCORE': {
      const corner = ctx.payload.corner as Corner
      const entryId = ctx.payload.entryId as string
      const points = ctx.payload.points as number
      assertBoutParticipantCorner({ entryId, corner, participants: ctx.participants })
      const episodeId = crypto.randomUUID()
      let execution = ctx.execution
      const createdEvents: BoutEventRecord[] = []

      const scoreResult = nextEvent(
        execution,
        {
          clientEventId: `${ctx.envelope.operationId}-score`,
          eventType: 'TECHNICAL_SCORE',
          entryId,
          cornerAtEvent: corner,
          points,
          episodeId,
          boutElapsedMs: execution.clockElapsedBeforeStartMs,
          period: execution.currentPeriod,
          payload: { source: 'ADJUDICATION' },
        },
        ctx.now,
      )
      execution = scoreResult.execution
      createdEvents.push(scoreResult.event)

      const adjudicationResult = nextEvent(
        execution,
        {
          clientEventId: `${ctx.envelope.operationId}-adj`,
          eventType: 'ADJUDICATION',
          entryId,
          cornerAtEvent: corner,
          points,
          episodeId,
          boutElapsedMs: execution.clockElapsedBeforeStartMs,
          period: execution.currentPeriod,
          payload: { episodeId, points },
        },
        ctx.now,
      )
      execution = adjudicationResult.execution
      createdEvents.push(adjudicationResult.event)

      return {
        execution: bumpRevision(execution),
        session: ctx.session,
        createdEvents,
        response: { ok: true, liveRevision: execution.liveRevision + 1 },
      }
    }

    case 'UNDO': {
      if (ctx.execution.activityCorrectionMode) {
        const targets = previewUndoTargets({
          events: ctx.events,
          attemptNumber: ctx.execution.attemptNumber,
          payload: {
            targetEpisodeId: ctx.payload.targetEpisodeId as string | undefined,
            targetEventIds: ctx.payload.targetEventIds as string[] | undefined,
          },
        })
        assertExtraPeriodUndoTargets(targets)
      }

      const undo = applyCompoundUndo({
        execution: ctx.execution,
        events: ctx.events,
        payload: {
          targetEpisodeId: ctx.payload.targetEpisodeId as string | undefined,
          targetEventIds: ctx.payload.targetEventIds as string[] | undefined,
        },
        now: ctx.now,
        operationId: ctx.envelope.operationId,
      })

      const mergedEvents = ctx.events.map((event) => {
        const updated = undo.undoneEvents.find((item) => item.id === event.id)
        return updated ?? event
      })

      const cornersSwapped = resolveCornersSwappedFromEvents(
        mergedEvents,
        undo.execution.attemptNumber,
      )
      const undoneTargets = previewUndoTargets({
        events: ctx.events,
        attemptNumber: ctx.execution.attemptNumber,
        payload: {
          targetEpisodeId: ctx.payload.targetEpisodeId as string | undefined,
          targetEventIds: ctx.payload.targetEventIds as string[] | undefined,
        },
      })
      const periodDurationMs = ctx.payload.periodDurationMs as number | undefined
      const executionAfterUndo =
        periodDurationMs != null
          ? revertUndoneClockAdjusts({
              execution: undo.execution,
              undoneTargets,
              periodDurationMs,
            })
          : undo.execution
      const execution = bumpRevision({
        ...executionAfterUndo,
        liveSnapshot: {
          ...(typeof executionAfterUndo.liveSnapshot === 'object' && executionAfterUndo.liveSnapshot
            ? (executionAfterUndo.liveSnapshot as Record<string, unknown>)
            : {}),
          cornersSwapped,
        },
      })

      return {
        execution,
        session: ctx.session,
        createdEvents: [undo.undoEvent],
        response: {
          ok: true,
          liveRevision: execution.liveRevision + 1,
          undoneEventIds: (undo.undoEvent.payload?.targetEventIds as string[]) ?? [],
          mergedEvents,
        },
      }
    }

    case 'CORRECT_BEFORE_ACTIVITY': {
      const enable = ctx.payload.enable !== false
      return {
        execution: bumpRevision({
          ...ctx.execution,
          activityCorrectionMode: enable,
        }),
        session: ctx.session,
        createdEvents: [],
        response: { ok: true, activityCorrectionMode: enable },
      }
    }

    case 'EXTRA_ACTIVITY_DECIDE': {
      const winnerCorner = ctx.payload.winnerCorner as Corner
      if (winnerCorner !== 'red' && winnerCorner !== 'blue') {
        throw new Error('winnerCorner is required')
      }
      const winnerEntryId = entryIdForCorner(winnerCorner, ctx.participants)
      const loserEntryId = entryIdForCorner(oppositeCorner(winnerCorner), ctx.participants)

      const { execution, event } = nextEvent(
        ctx.execution,
        {
          clientEventId: ctx.envelope.operationId,
          eventType: 'EXTRA_ACTIVITY_DECISION',
          entryId: null,
          cornerAtEvent: winnerCorner,
          points: null,
          episodeId: null,
          boutElapsedMs: ctx.execution.clockElapsedBeforeStartMs,
          period: 'extra',
          payload: {
            winnerCorner,
            winnerEntryId,
            loserEntryId,
          },
        },
        ctx.now,
      )

      const decision = {
        winnerEntryId,
        loserEntryId,
        reason: 'EXTRA_ACTIVITY' as const,
        decidedInPeriod: 'extra' as const,
        details: { winnerCorner },
      }

      const stoppage = recordBoutStoppage({
        execution,
        events: [...ctx.events, event],
        participants: ctx.participants,
        decision,
        trigger: 'EXTRA_ACTIVITY',
        victoryMethod: 'POINTS',
        now: ctx.now,
        triggerEventId: event.id,
      })

      return {
        execution: bumpRevision(stoppage.execution),
        session: { ...ctx.session, activeBoutId: ctx.execution.boutId },
        createdEvents: [
          event,
          ...stoppage.auxiliaryCloseEvents,
          stoppage.stoppageEvent,
        ],
        response: { ok: true, liveRevision: stoppage.execution.liveRevision + 1 },
      }
    }

    case 'STOPPAGE_SUBMISSION':
    case 'STOPPAGE_CHOKE':
    case 'STOPPAGE_CLEAR_ADVANTAGE':
    case 'STOPPAGE_FORFEIT':
    case 'STOPPAGE_INJURY': {
      const winnerCorner = ctx.payload.winnerCorner as Corner | undefined
      const forfeitingCorner = ctx.payload.forfeitingCorner as Corner | undefined
      const injuredCorner = ctx.payload.injuredCorner as Corner | undefined
      const corner =
        winnerCorner ??
        (forfeitingCorner ? oppositeCorner(forfeitingCorner) : undefined) ??
        (injuredCorner ? oppositeCorner(injuredCorner) : undefined)
      if (!corner) {
        throw new Error('winner corner required for stoppage')
      }

      const winnerEntryId = entryIdForCorner(corner, ctx.participants)
      const loserEntryId = entryIdForCorner(oppositeCorner(corner), ctx.participants)
      const victoryMethod =
        ctx.intent === 'STOPPAGE_SUBMISSION'
          ? 'SUBMISSION'
          : ctx.intent === 'STOPPAGE_CHOKE'
            ? 'CHOKE'
            : ctx.intent === 'STOPPAGE_FORFEIT'
              ? 'FORFEIT'
              : ctx.intent === 'STOPPAGE_INJURY'
                ? 'INJURY'
                : 'CLEAR_ADVANTAGE'
      const reason =
        ctx.intent === 'STOPPAGE_SUBMISSION'
          ? 'SUBMISSION'
          : ctx.intent === 'STOPPAGE_CHOKE'
            ? 'CHOKE'
            : ctx.intent === 'STOPPAGE_FORFEIT'
              ? 'FORFEIT'
              : ctx.intent === 'STOPPAGE_INJURY'
                ? 'INJURY'
                : 'CLEAR_ADVANTAGE'

      const stoppage = recordBoutStoppage({
        execution: ctx.execution,
        events: ctx.events,
        participants: ctx.participants,
        decision: {
          winnerEntryId,
          loserEntryId,
          reason,
          decidedInPeriod: ctx.execution.currentPeriod,
          details:
            ctx.intent === 'STOPPAGE_SUBMISSION'
              ? { submissionSubtype: ctx.payload.submissionSubtype as 'ARM' | 'LEG' | 'OTHER' }
              : undefined,
        },
        trigger:
          ctx.intent === 'STOPPAGE_SUBMISSION'
            ? 'SUBMISSION'
            : ctx.intent === 'STOPPAGE_CHOKE'
              ? 'SUBMISSION'
              : ctx.intent === 'STOPPAGE_FORFEIT'
                ? 'FORFEIT'
                : ctx.intent === 'STOPPAGE_INJURY'
                  ? 'INJURY'
                  : 'CLEAR_ADVANTAGE',
        victoryMethod,
        now: ctx.now,
      })

      return {
        execution: bumpRevision(stoppage.execution),
        session: { ...ctx.session, activeBoutId: ctx.execution.boutId },
        createdEvents: [...stoppage.auxiliaryCloseEvents, stoppage.stoppageEvent],
        response: { ok: true, liveRevision: stoppage.execution.liveRevision + 1 },
      }
    }

    case 'OPEN_NEXT_BOUT': {
      return {
        execution: ctx.execution,
        session: { ...ctx.session, activeBoutId: null },
        createdEvents: [],
        response: { ok: true, liveRevision: ctx.execution.liveRevision },
      }
    }

    case 'RESET_BOUT': {
      const closed = closeOpenAuxiliaryEvents({
        execution: ctx.execution,
        events: ctx.events,
        operationId: ctx.envelope.operationId,
        now: ctx.now,
      })
      const reset = resetBoutExecutionForRerun(closed.execution)
      const session = {
        ...ctx.session,
        activeBoutId: ctx.execution.boutId,
      }
      const execution = bumpRevision(reset)
      return {
        execution,
        session,
        createdEvents: closed.createdEvents,
        response: {
          ok: true,
          reset: true,
          liveRevision: execution.liveRevision,
          attemptNumber: execution.attemptNumber,
          boutPhase: execution.boutPhase,
        },
      }
    }

    case 'PASSIVITY_START':
    case 'PASSIVITY_END': {
      const eventType = ctx.intent
      const corner = ctx.payload.corner as Corner | undefined
      const entryId = (ctx.payload.entryId as string | undefined) ?? null
      if (
        (eventType === 'PASSIVITY_START' || eventType === 'PASSIVITY_END') &&
        (!entryId || !corner)
      ) {
        throw new Error('entryId and corner required for passivity')
      }

      const { execution, event } = nextEvent(
        ctx.execution,
        {
          clientEventId: ctx.envelope.operationId,
          eventType,
          entryId,
          cornerAtEvent: corner ?? null,
          points: null,
          episodeId: null,
          boutElapsedMs: computeClockElapsedMs(ctx.execution, ctx.now),
          period: ctx.execution.currentPeriod,
          payload: null,
        },
        ctx.now,
      )

      return {
        execution: bumpRevision(execution),
        session: ctx.session,
        createdEvents: [event],
        response: { ok: true, liveRevision: execution.liveRevision + 1 },
      }
    }

    default:
      throw new Error(`Unsupported intent: ${ctx.intent}`)
  }
}

export function routeMatControlCommand(ctx: CommandRouterContext): CommandRouterResult {
  const result = applyMatControlIntent(ctx)
  return {
    ...result,
    session: pinSessionActiveBoutIfNeeded({
      session: result.session,
      boutId: ctx.execution.boutId,
      execution: result.execution,
      intent: ctx.intent,
    }),
  }
}
