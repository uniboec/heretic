import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { applyBoutResultToCompetitionStructure } from '../brackets/applyBoutResultToCompetitionStructure'
import { lockCompetitionDrawForCategory } from './lockCompetitionForBout'
import { loadFullScheduleSnapshot } from './scheduleService'
import {
  buildMatCompletedBoutIds,
  findMatInProgressBoutId,
  isMatBoutCompleted,
} from './matBoutCompletion'
import { lockMatScheduleRuntimeRows } from './locks'
import { assertBoutBelongsToMat } from './assertBoutBelongsToMat'
import { resolveMatIndexFromBout } from './resolveMatIndexFromBout'
import {
  finalizeBoutControlCommand,
  reserveBoutControlCommand,
} from './boutControlCommand'
import {
  acquireMatControlSession,
  assertMatControlLease,
  ensureMatControlSession,
  heartbeatMatControlSession,
  lockMatControlSessionForUpdate,
  readMatControlSession,
  releaseMatControlSession,
  takeoverMatControlSession,
  updateMatControlSession,
} from './matControlSession'
import { routeMatControlCommand } from './matControlCommandRouter'
import {
  MAT_CONTROL_SNAPSHOT_TRANSACTION_OPTIONS,
  MAT_CONTROL_TRANSACTION_OPTIONS,
} from './matControlTransaction'
import { reduceScoreEvents } from './scoreEngine'
import { resolveEffectiveBoutStoppage } from './resolveEffectiveBoutStoppage'
import { wasFightClockStarted } from '../fastestFights/fightClockStarted'
import { resolveFastestFightBoutResultFields } from '../fastestFights/resolveFastestFightBoutResultFields'
import { computeRestUntil } from './restRules'
import { resolveBoutDurationMinutes } from './boutDuration'
import { resolvePeriodDurationMs } from './boutLiveSnapshot'
import {
  buildMatScheduleEntries,
  buildParticipantContext,
  findBoutInSchedule,
  loadBoutEvents,
  resolveCornersSwappedFromEvents,
} from './matControlContext'
import {
  createDefaultExecutionData,
  mapEventRow,
  mapExecutionRow,
  mapExecutionToPrismaUpdate,
} from './matControlMappers'
import type { AdminSessionRole } from '../auth'
import { getAdminSessionRole } from '../auth'
import { loadBoutCorrectionMeta } from './boutCorrectionMeta'
import { persistBoutReset } from './persistBoutReset'
import { loadRecentMatBouts } from './recentMatBouts'
import {
  buildMatQueue,
  buildMatQueueInOrder,
  resolveMatControlTargetBoutId,
  shouldAutoAlignMatSessionActiveBout,
} from './matQueue'
import { isAthleteParticipationSpacingEnabled } from './athleteParticipationSpacing'
import { loadEntryToAthleteMapForBouts } from './athleteIdentity'
import { orderMatBoutsForRuntime } from './matRuntimeOrder'
import { buildRuntimeMatOrders } from './runtimeMatOrders'
import { persistBoutScheduleWavesIfChanged } from './boutScheduleWaves.server'
import { collectMatPostponeCascadeBoutIds } from './postponeCascade'
import { buildMatBoutsNav } from './buildMatBoutsNav'
import { enrichBoutsWithScheduleDisplay } from './enrichBoutsWithScheduleDisplay'
import { resolveMatBoutDisplayStatuses } from './presentation/boutDisplayStatus'
import { buildBoutSnapshot, type MatControlSnapshot } from './matControlSnapshot'
import { buildScheduledMats } from './scheduleService'
import { freezeScheduleForMatControlCommand } from './freezeScheduleForMatControl'
import { assertCompletedBoutHasFrozenNumber } from './freezeScheduleNumber'
import {
  collectBoutEntryRefs,
  loadMatControlEntryWarnings,
} from '../mandate/matControlWarnings'
import { applyRuntimeNextStartableFlags } from './runtimeNextStartable'
import type {
  BoutMutationEnvelope,
  ControlIntent,
  MatControlExecution,
  MatControlSessionRecord,
} from './mat-control/types'
import type { InternalBout } from './types'

async function lockExecutionForUpdate(
  tx: Prisma.TransactionClient,
  boutId: string,
): Promise<MatControlExecution> {
  const rows = await tx.$queryRaw<
    Array<{
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
      boutPhase: string
      clockState: string
      clockStartedAt: Date | null
      clockElapsedBeforeStartMs: number
      currentPeriod: string
      nextEventSequence: number
      liveRevision: number
      liveSnapshot: unknown
    }>
  >`
    SELECT *
    FROM "BoutScheduleExecution"
    WHERE "boutId" = ${boutId}
    FOR UPDATE
  `

  if (rows.length === 0) {
    const created = await tx.boutScheduleExecution.create({
      data: createDefaultExecutionData(boutId),
    })
    return mapExecutionRow(created)
  }

  return mapExecutionRow(rows[0] as Parameters<typeof mapExecutionRow>[0])
}

async function persistEvents(
  tx: Prisma.TransactionClient,
  events: Array<{
    boutId: string
    clientEventId: string
    sequence: number
    eventType: string
    entryId: string | null
    cornerAtEvent: string | null
    points: number | null
    episodeId: string | null
    boutElapsedMs: number | null
    period: string
    attemptNumber: number
    payload: Record<string, unknown> | null
    createdAt: Date
    eventStatus?: string
    eventHash?: string | null
    boutSessionId?: string | null
  }>,
): Promise<string[]> {
  const ids: string[] = []
  for (const event of events) {
    const row = await tx.boutEvent.create({
      data: {
        boutId: event.boutId,
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        clientEventId: event.clientEventId,
        sequence: event.sequence,
        eventType: event.eventType,
        entryId: event.entryId,
        cornerAtEvent: event.cornerAtEvent,
        points: event.points,
        episodeId: event.episodeId,
        boutElapsedMs: event.boutElapsedMs,
        period: event.period,
        attemptNumber: event.attemptNumber,
        payload: event.payload as Prisma.InputJsonValue,
        createdAt: event.createdAt,
        eventStatus: event.eventStatus ?? 'COMMITTED',
        eventHash: event.eventHash ?? null,
        boutSessionId: event.boutSessionId ?? null,
      },
    })
    ids.push(row.id)
  }
  return ids
}

async function persistConfirmResult(input: {
  tx: Prisma.TransactionClient
  bout: InternalBout
  execution: MatControlExecution
  events: ReturnType<typeof mapEventRow>[]
  resultPayload: {
    winnerEntryId: string | null
    loserEntryId: string | null
    victoryMethod: string
    decisionReason: string
    decidedInPeriod: string
    officialEndedAt: string
    resultConfirmedAt: string
    confirmedBy?: string
  }
  durationOverrides: Record<string, number>
  skipBracketPromotion?: boolean
}) {
  const mainScore = reduceScoreEvents(input.events, 'main', input.execution.attemptNumber)
  const extraScore =
    input.execution.currentPeriod === 'extra' || input.resultPayload.decidedInPeriod === 'extra'
      ? reduceScoreEvents(input.events, 'extra', input.execution.attemptNumber)
      : null

  const existingVersions = await input.tx.boutResult.count({ where: { boutId: input.bout.id } })
  const resultVersion = existingVersions + 1

  await input.tx.boutResult.updateMany({
    where: { boutId: input.bout.id, isCurrent: true },
    data: { isCurrent: false },
  })

  const effectiveStoppage = resolveEffectiveBoutStoppage(input.events)
  const fastestFightFields = resolveFastestFightBoutResultFields(
    input.resultPayload.victoryMethod,
    effectiveStoppage,
    { fightOfficiallyStarted: wasFightClockStarted(input.events) },
  )

  await input.tx.boutResult.create({
    data: {
      boutId: input.bout.id,
      resultVersion,
      isCurrent: true,
      tournamentScopeId: TOURNAMENT_SCOPE_ID,
      winnerEntryId: input.resultPayload.winnerEntryId,
      loserEntryId: input.resultPayload.loserEntryId,
      victoryMethod: input.resultPayload.victoryMethod,
      decisionReason: input.resultPayload.decisionReason,
      decidedInPeriod: input.resultPayload.decidedInPeriod,
      mainRedScore: mainScore.officialScore.red,
      mainBlueScore: mainScore.officialScore.blue,
      extraRedScore: extraScore?.officialScore.red ?? null,
      extraBlueScore: extraScore?.officialScore.blue ?? null,
      cornersSwapped: resolveCornersSwappedFromEvents(
        input.events,
        input.execution.attemptNumber,
      ),
      officialEndedAt: new Date(input.resultPayload.officialEndedAt),
      resultConfirmedAt: new Date(input.resultPayload.resultConfirmedAt),
      boutElapsedMs: fastestFightFields.boutElapsedMs,
      fightOfficiallyStarted: wasFightClockStarted(input.events),
      stoppageTrigger: fastestFightFields.stoppageTrigger,
      stoppageEventId: fastestFightFields.stoppageEventId,
      confirmedBy: input.resultPayload.confirmedBy ?? null,
      attemptNumber: input.execution.attemptNumber,
      resultStatus: 'ACTIVE',
    },
  })

  const durationMs =
    resolveBoutDurationMinutes({
      categoryKey: input.bout.categoryKey,
      overrides: input.durationOverrides,
    }) * 60_000

  const officialEndedAt = new Date(input.resultPayload.officialEndedAt)
  const entryIds = [input.bout.sideA, input.bout.sideB]
    .filter((side) => side.kind === 'athlete')
    .map((side) => side.entryId)

  for (const entryId of entryIds) {
    const restUntil = computeRestUntil({
      mainBoutDurationMs: durationMs,
      schedulePhase: input.bout.schedulePhase,
      officialEndedAt,
    })
    await input.tx.athleteRestState.upsert({
      where: {
        tournamentScopeId_entryId: {
          tournamentScopeId: TOURNAMENT_SCOPE_ID,
          entryId,
        },
      },
      create: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        entryId,
        restUntil,
        sourceBoutId: input.bout.id,
        sourceAttemptNumber: input.execution.attemptNumber,
      },
      update: {
        restUntil,
        sourceBoutId: input.bout.id,
        sourceAttemptNumber: input.execution.attemptNumber,
        invalidatedAt: null,
      },
    })
  }

  if (!input.skipBracketPromotion) {
    await applyBoutResultToCompetitionStructure(input.tx, {
      boutId: input.bout.id,
      categoryKey: input.bout.categoryKey,
      winnerEntryId: input.resultPayload.winnerEntryId,
      loserEntryId: input.resultPayload.loserEntryId,
      schedulePhase: input.bout.schedulePhase,
    })
  }

  const frozenRow = await input.tx.boutScheduleExecution.findUnique({
    where: { boutId: input.bout.id },
    select: {
      boutId: true,
      actualStartAt: true,
      actualEndAt: true,
      frozenScheduleFormatted: true,
      frozenScheduleMatNumber: true,
      frozenSchedulePosition: true,
    },
  })
  if (frozenRow) {
    assertCompletedBoutHasFrozenNumber({
      boutId: frozenRow.boutId,
      actualStartAt: frozenRow.actualStartAt,
      actualEndAt: frozenRow.actualEndAt ?? new Date(input.resultPayload.officialEndedAt),
      frozenScheduleFormatted: frozenRow.frozenScheduleFormatted,
      frozenScheduleMatNumber: frozenRow.frozenScheduleMatNumber,
      frozenSchedulePosition: frozenRow.frozenSchedulePosition,
    })
  }
}

async function loadMatContext(tx: Prisma.TransactionClient, matIndex: number) {
  const snapshot = await loadFullScheduleSnapshot(tx, { adminPreview: true })
  const matGroup = snapshot.grouped.mats.find((mat) => mat.matIndex === matIndex)
  if (!matGroup) {
    throw new Error(`Mat ${matIndex} not found`)
  }
  const scheduleEntries = buildMatScheduleEntries(snapshot.grouped)
  return { snapshot, matGroup, scheduleEntries }
}

function isMatControlSerializationError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2010' || error.code === 'P2034') &&
    (error.meta as { code?: string } | undefined)?.code === '40001'
  )
}

async function buildMatControlSnapshotTx(
  matIndex: number,
  sessionRole: AdminSessionRole,
): Promise<MatControlSnapshot> {
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    const { snapshot, matGroup } = await loadMatContext(tx, matIndex)
    await ensureMatControlSession(tx, matIndex)
    const spacingEnabled = isAthleteParticipationSpacingEnabled(
      snapshot.settings.athleteParticipationSpacing,
    )

    const matBoutIds = snapshot.grouped.mats
      .find((mat) => mat.matIndex === matIndex)
      ?.bouts.map((bout) => bout.id) ?? []
    const matExecutionRows =
      matBoutIds.length > 0
        ? await tx.boutScheduleExecution.findMany({
            where: { boutId: { in: matBoutIds } },
            select: {
              boutId: true,
              boutPhase: true,
              actualStartAt: true,
              actualEndAt: true,
              clockStartedAt: true,
              officialStartedAt: true,
            },
          })
        : []
    const completedBoutIds = buildMatCompletedBoutIds(matExecutionRows)
    const allMatSessions = await tx.matControlSession.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
      select: { matIndex: true, activeBoutId: true },
    })
    const allMatExecutionRows =
      snapshot.grouped.mats.length > 0
        ? await tx.boutScheduleExecution.findMany({
            where: {
              boutId: {
                in: snapshot.grouped.mats.flatMap((mat) => mat.bouts.map((bout) => bout.id)),
              },
            },
            select: {
              boutId: true,
              boutPhase: true,
              actualStartAt: true,
              actualEndAt: true,
              clockStartedAt: true,
              officialStartedAt: true,
            },
          })
        : []

    const restRows = await tx.athleteRestState.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const restUntilByEntryId = new Map(
      restRows
        .filter((row) => !row.invalidatedAt)
        .map((row) => [row.entryId, row.restUntil]),
    )

    const entryToAthlete = spacingEnabled
      ? await loadEntryToAthleteMapForBouts(
          snapshot.grouped.mats.flatMap((mat) => mat.bouts),
          tx,
        )
      : new Map<string, string>()

    const globalCompletedBoutIds = buildMatCompletedBoutIds(allMatExecutionRows)
    const activeBoutIds = new Set(
      allMatSessions
        .map((row) => row.activeBoutId)
        .filter((boutId): boutId is string => boutId != null),
    )

    const runtimeOrders = spacingEnabled
      ? buildRuntimeMatOrders({
          groupedMats: snapshot.grouped.mats,
          overrides: snapshot.scheduleOverrides,
          settings: snapshot.settings,
          entryToAthlete,
          executions: allMatExecutionRows,
          restUntilByEntryId,
          completedBoutIds: globalCompletedBoutIds,
          activeBoutIds,
          now,
        })
      : null

    if (spacingEnabled && runtimeOrders) {
      await persistBoutScheduleWavesIfChanged(
        tx,
        runtimeOrders.boutScheduleWaves,
        snapshot.settings.boutScheduleWaves,
      )
    }

    const scheduledMats = buildScheduledMats({
      grouped: snapshot.grouped,
      snapshot,
      now,
    })
    const scheduledBouts = scheduledMats.mats.flatMap((mat) => mat.bouts)

    const matExecutions = new Map(
      snapshot.executions
        .filter((row) => matBoutIds.includes(row.boutId))
        .map((row) => [row.boutId, row]),
    )
    const orderedMatBouts = applyRuntimeNextStartableFlags(
      enrichBoutsWithScheduleDisplay(
        spacingEnabled
          ? (runtimeOrders!.perMatOrder.get(matIndex) ??
            orderMatBoutsForRuntime({
              groupedMats: snapshot.grouped.mats,
              matIndex,
              overrides: snapshot.scheduleOverrides,
              settings: snapshot.settings,
            }))
          : orderMatBoutsForRuntime({
              groupedMats: snapshot.grouped.mats,
              matIndex,
              overrides: snapshot.scheduleOverrides,
              settings: snapshot.settings,
            }),
        scheduledBouts,
      ),
      matIndex,
      matExecutions,
    )

    const matBoutIdSet = new Set(matBoutIds)
    const matInProgressBoutId = findMatInProgressBoutId(matExecutionRows, matBoutIdSet)
    const displayStatuses = resolveMatBoutDisplayStatuses({
      orderedBoutIds: orderedMatBouts.map((bout) => bout.id),
      executions: new Map(matExecutionRows.map((row) => [row.boutId, row])),
    })
    const matBoutsNav = buildMatBoutsNav({
      orderedMatBouts,
      executions: matExecutionRows,
      displayStatuses,
    })

    const currentSession = await readMatControlSession(tx, matIndex)
    let sessionActivePhase: string | null = null
    if (currentSession.activeBoutId) {
      const sessionActiveExecution = await tx.boutScheduleExecution.findUnique({
        where: { boutId: currentSession.activeBoutId },
        select: { boutPhase: true },
      })
      sessionActivePhase = sessionActiveExecution?.boutPhase ?? 'scheduled'
    }

    const targetBoutId = resolveMatControlTargetBoutId({
      sessionActiveBoutId: currentSession.activeBoutId,
      sessionActiveBoutPhase: sessionActivePhase,
      orderedMatBouts,
      matBoutIds: matBoutIdSet,
      completedBoutIds,
      restUntilByEntryId,
      now,
      skipRestBlocks: spacingEnabled,
      matInProgressBoutId,
      correctionFocusBoutId: currentSession.correctionFocusBoutId,
    })

    let resolvedSession = currentSession
    const shouldAutoAlignSession = shouldAutoAlignMatSessionActiveBout({
      sessionActiveBoutId: currentSession.activeBoutId,
      matBoutIds: matBoutIdSet,
      completedBoutIds,
      correctionFocusBoutId: currentSession.correctionFocusBoutId,
    })
    if (shouldAutoAlignSession && targetBoutId !== currentSession.activeBoutId) {
      resolvedSession = await updateMatControlSession(tx, matIndex, {
        activeBoutId: targetBoutId,
        revision: { increment: 1 },
      })
    }

    let activeBoutSnapshot = null

    if (targetBoutId) {
      const located = findBoutInSchedule(targetBoutId, snapshot.grouped)
      const scheduledBout = scheduledBouts.find((bout) => bout.id === targetBoutId)
      const orderedBout = orderedMatBouts.find((bout) => bout.id === targetBoutId)
      const boutForSnapshot = orderedBout
        ? {
            ...orderedBout,
            sideA: scheduledBout?.sideA ?? orderedBout.sideA,
            sideB: scheduledBout?.sideB ?? orderedBout.sideB,
            scheduleDisplayNumber:
              scheduledBout?.scheduleDisplayNumber ?? orderedBout.scheduleDisplayNumber,
          }
        : scheduledBout
          ? {
              ...located.bout,
              sideA: scheduledBout.sideA,
              sideB: scheduledBout.sideB,
              scheduleDisplayNumber: scheduledBout.scheduleDisplayNumber,
            }
          : located.bout
      let execution = await tx.boutScheduleExecution.findUnique({
        where: { boutId: targetBoutId },
      })
      if (!execution) {
        execution = await tx.boutScheduleExecution.create({
          data: createDefaultExecutionData(targetBoutId),
        })
      }
      const eventRows = await loadBoutEvents(tx, targetBoutId)
      const events = eventRows.map(mapEventRow)
      const correctionMeta = await loadBoutCorrectionMeta(tx, located.bout)
      activeBoutSnapshot = buildBoutSnapshot({
        bout: boutForSnapshot,
        execution: mapExecutionRow(execution),
        participants: buildParticipantContext(boutForSnapshot, execution.liveSnapshot),
        events,
        durationOverrides: snapshot.settings.ageDivisionDurationOverrides,
        correctionMeta,
        now,
      })
    }

    const queue = buildMatQueue({
      bouts: orderedMatBouts,
      completedBoutIds,
      activeBoutId: targetBoutId,
      restUntilByEntryId,
      now,
      skipRestBlocks: spacingEnabled,
    })
    const queueInOrder = buildMatQueueInOrder({
      bouts: orderedMatBouts,
      completedBoutIds,
      activeBoutId: targetBoutId,
      restUntilByEntryId,
      now,
      skipRestBlocks: spacingEnabled,
    })

    const scheduleDisplayByBoutId = new Map(
      orderedMatBouts
        .filter((bout) => bout.scheduleDisplayNumber)
        .map((bout) => [bout.id, bout.scheduleDisplayNumber!]),
    )
    const recentBouts = await loadRecentMatBouts(
      tx,
      orderedMatBouts,
      completedBoutIds,
      scheduleDisplayByBoutId,
    )
    const pendingMatBoutIds = orderedMatBouts
      .filter((bout) => !completedBoutIds.has(bout.id))
      .map((bout) => bout.id)
    const postponeCascadeBoutIds =
      targetBoutId && activeBoutSnapshot?.execution.boutPhase === 'scheduled'
        ? collectMatPostponeCascadeBoutIds({
            rootBoutId: targetBoutId,
            matBouts: matGroup.bouts,
            completedBoutIds,
            runnableMatBoutIds: pendingMatBoutIds,
            overrides: snapshot.scheduleOverrides,
          })
        : []

    const warningRefs = new Map<string, { entryId: string; categoryKey: string }>()
    for (const queueEntry of queueInOrder) {
      for (const ref of collectBoutEntryRefs(queueEntry.bout)) {
        warningRefs.set(ref.entryId, ref)
      }
    }
    let entryWarnings: MatControlSnapshot['entryWarnings'] = {}
    let entryAthleteIds: MatControlSnapshot['entryAthleteIds'] = {}
    try {
      const mandateContext = await loadMatControlEntryWarnings([...warningRefs.values()])
      entryWarnings = mandateContext.entryWarnings
      entryAthleteIds = mandateContext.entryAthleteIds
    } catch (error) {
      console.warn('Mat control mandate warnings unavailable', error)
    }

    const moveMatTargetOptions = Array.from(
      { length: snapshot.settings.matCount },
      (_, index) => index + 1,
    ).filter((index) => index !== matIndex)

    let boutSession: MatControlSnapshot['boutSession'] = null
    if (targetBoutId) {
      const { markStaleSessionsFromHeartbeatTimeout } = await import(
        './matControlReliability/ownership'
      )
      await markStaleSessionsFromHeartbeatTimeout(tx)
      const ownership = await tx.boutSessionOwnership.findFirst({
        where: { boutId: targetBoutId, releasedAt: null },
        orderBy: { leasedAt: 'desc' },
      })
      if (ownership) {
        boutSession = {
          boutSessionId: ownership.boutSessionId,
          ownershipEpoch: ownership.ownershipEpoch,
          clientSessionId: ownership.clientSessionId,
          sessionStatus: ownership.sessionStatus,
          staleAt: ownership.staleAt?.toISOString() ?? null,
          expectedSequenceNo: ownership.expectedSequenceNo,
        }
      }
    }

    return {
      matIndex,
      matCount: snapshot.settings.matCount,
      moveMatTargetOptions,
      boutSession,
      session: resolvedSession,
      activeBout: activeBoutSnapshot,
      pendingMatBoutIds,
      postponeCascadeBoutIds,
      queue,
      queueInOrder,
      recentBouts,
      permissions: {
        role: sessionRole,
        canCorrectResult: sessionRole === 'admin',
        canResetBout: sessionRole === 'admin',
      },
      entryWarnings,
      entryAthleteIds,
      matBoutsNav,
      matInProgressBoutId,
      scheduleVersion: snapshot.settings.scheduleVersion,
      now: now.toISOString(),
    }
  }, MAT_CONTROL_SNAPSHOT_TRANSACTION_OPTIONS)
}

export async function getMatControlSnapshot(
  matIndex: number,
  sessionRole: AdminSessionRole = 'admin',
): Promise<MatControlSnapshot> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await buildMatControlSnapshotTx(matIndex, sessionRole)
    } catch (error) {
      lastError = error
      if (isMatControlSerializationError(error) && attempt < 2) {
        await sleep(30 * (attempt + 1))
        continue
      }
      throw error
    }
  }
  throw lastError
}

export async function focusMatBout(input: {
  matIndex: number
  boutId: string
  holderToken: string
  sessionRole?: AdminSessionRole
}): Promise<MatControlSnapshot> {
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    const session = await lockMatControlSessionForUpdate(tx, input.matIndex)
    assertMatControlLease(session, input.holderToken, now)

    const { matGroup } = await loadMatContext(tx, input.matIndex)
    const boutOnMat = matGroup.bouts.some((bout) => bout.id === input.boutId)
    if (!boutOnMat) {
      throw new Error('Поединок не назначен на этот ковёр')
    }

    const execution = await tx.boutScheduleExecution.findUnique({
      where: { boutId: input.boutId },
    })
    const isCompleted = execution
      ? isMatBoutCompleted({
          boutId: execution.boutId,
          boutPhase: execution.boutPhase,
          actualStartAt: execution.actualStartAt,
          actualEndAt: execution.actualEndAt,
          clockStartedAt: execution.clockStartedAt,
          officialStartedAt: execution.officialStartedAt,
        })
      : false

    await updateMatControlSession(tx, input.matIndex, {
      activeBoutId: input.boutId,
      correctionFocusBoutId: isCompleted ? input.boutId : null,
      revision: { increment: 1 },
    })
  }, MAT_CONTROL_TRANSACTION_OPTIONS)

  const { kickAnnouncerWorker } = await import('../announcer/worker')
  kickAnnouncerWorker()

  return getMatControlSnapshot(input.matIndex, input.sessionRole ?? 'admin')
}

function isPendingCommandResponse(responseJson: unknown): boolean {
  if (!responseJson || typeof responseJson !== 'object') {
    return true
  }
  const record = responseJson as Record<string, unknown>
  return !('liveRevision' in record) && !('ok' in record)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function executeMatControlCommand(input: {
  boutId: string
  envelope: BoutMutationEnvelope
  intent: ControlIntent
  payload: Record<string, unknown>
  expectedScheduleVersion?: number
}) {
  const { assertMatControlWritesAllowed } = await import('./eventFinalized')
  await assertMatControlWritesAllowed()

  const { computeRequestFingerprint } = await import('./computeRequestFingerprint')
  const { IdempotencyKeyReusedError } = await import('./mat-control/errors')
  const requestFingerprint = computeRequestFingerprint(input.intent, input.payload)

  const actorId = (await getAdminSessionRole()) ?? null
  await freezeScheduleForMatControlCommand({
    boutId: input.boutId,
    intent: input.intent,
    operationId: input.envelope.operationId,
    expectedScheduleVersion: input.expectedScheduleVersion,
    payload: input.payload,
    actorId,
  })

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const now = new Date()
    let response: unknown
    try {
      response = await prisma.$transaction(
      async (tx) => {
      if (input.envelope.reliability) {
        const { validateReliabilityFencing } = await import(
          './matControlReliability/applyReliabilityCommand'
        )
        await validateReliabilityFencing(tx, {
          boutId: input.boutId,
          commandId: input.envelope.operationId,
          boutSessionId: input.envelope.reliability.boutSessionId,
          clientSessionId: input.envelope.reliability.clientSessionId,
          ownershipEpoch: input.envelope.reliability.ownershipEpoch,
          sequenceNo: input.envelope.reliability.sequenceNo,
          intent: input.intent,
          payload: input.payload,
          payloadHash: input.envelope.reliability.payloadHash,
          includeBoutElapsedMs: true,
        })
      }

      const existing = await tx.boutControlCommand.findUnique({
        where: {
          boutId_operationId: {
            boutId: input.boutId,
            operationId: input.envelope.operationId,
          },
        },
      })
      if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) {
          throw new IdempotencyKeyReusedError()
        }
        if (!isPendingCommandResponse(existing.responseJson)) {
          return existing.responseJson
        }
      }

      const reserve = await reserveBoutControlCommand({
        tx,
        boutId: input.boutId,
        operationId: input.envelope.operationId,
        commandType: input.intent,
        payload: input.payload,
      })
      if (reserve.kind === 'replay') {
        if (isPendingCommandResponse(reserve.responseJson)) {
          return null
        }
        return reserve.responseJson
      }

      const snapshot = await loadFullScheduleSnapshot(tx, { adminPreview: true })
      const scheduleEntries = buildMatScheduleEntries(snapshot.grouped)
      const matIndex = resolveMatIndexFromBout(input.boutId, scheduleEntries)
      const { bout, matIndex: boutMatIndex } = findBoutInSchedule(input.boutId, snapshot.grouped)

      await lockMatScheduleRuntimeRows(tx, [matIndex])
      const session = await lockMatControlSessionForUpdate(tx, matIndex)
      assertMatControlLease(session, input.envelope.holderToken, now)
      assertBoutBelongsToMat(input.boutId, matIndex, boutMatIndex)

      if (input.intent === 'CONFIRM' || input.intent === 'RESET_BOUT') {
        await lockCompetitionDrawForCategory(tx, bout.categoryKey)
      }

      if (input.intent === 'RESET_BOUT') {
        const role = await getAdminSessionRole()
        if (role !== 'admin') {
          const { CommandNotAllowedError } = await import('./mat-control/errors')
          throw new CommandNotAllowedError('Сброс поединка доступен только администратору')
        }
      }

      let execution = await lockExecutionForUpdate(tx, input.boutId)
      const eventRows = await loadBoutEvents(tx, input.boutId)
      const events = eventRows.map(mapEventRow)
      const participants = buildParticipantContext(bout, execution.liveSnapshot)

      const durationPeriod =
        input.intent === 'EXPIRE_PERIOD' && input.payload.period
          ? (input.payload.period as 'main' | 'extra')
          : execution.currentPeriod
      const periodDurationMs = resolvePeriodDurationMs({
        liveSnapshot: execution.liveSnapshot,
        period: durationPeriod,
        categoryKey: bout.categoryKey,
        overrides: snapshot.settings.ageDivisionDurationOverrides,
      })

      const commandPayload =
        input.intent === 'EXPIRE_PERIOD' ||
        input.intent === 'CLOCK_ADJUST' ||
        input.intent === 'UNDO'
          ? { ...input.payload, periodDurationMs }
          : input.payload

      if (!execution.frozenScheduleFormatted) {
        const frozenRow = await tx.boutScheduleExecution.findUnique({
          where: { boutId: input.boutId },
          select: {
            frozenScheduleFormatted: true,
            frozenScheduleMatNumber: true,
            frozenSchedulePosition: true,
          },
        })
        if (frozenRow?.frozenScheduleFormatted) {
          execution = {
            ...execution,
            frozenScheduleFormatted: frozenRow.frozenScheduleFormatted,
            frozenScheduleMatNumber: frozenRow.frozenScheduleMatNumber,
            frozenSchedulePosition: frozenRow.frozenSchedulePosition,
          }
        }
      }

      const result = routeMatControlCommand({
        execution,
        session,
        participants,
        events,
        now,
        envelope: input.envelope,
        intent: input.intent,
        payload: commandPayload,
      })

      const undoneEventIds = result.response.undoneEventIds as string[] | undefined
      if (undoneEventIds?.length) {
        await tx.boutEvent.updateMany({
          where: { id: { in: undoneEventIds } },
          data: { undoneAt: now },
        })
      }

      const reliability = input.envelope.reliability
      const { computeEventHash } = await import('./matControlReliability/hash')
      const { buildCanonicalEventFromCreated } = await import(
        './matControlReliability/commandPayload'
      )
      const { bumpReliabilitySequence } = await import(
        './matControlReliability/applyReliabilityCommand'
      )

      const createdEventIds = await persistEvents(
        tx,
        result.createdEvents.map((event, index) => {
          const sequenceNo = reliability
            ? reliability.sequenceNo + index
            : event.sequence
          const eventHash = reliability
            ? computeEventHash(
                buildCanonicalEventFromCreated({
                  type: event.eventType,
                  commandId: event.clientEventId,
                  sequenceNo,
                  boutElapsedMs: event.boutElapsedMs ?? 0,
                  payload: event.payload,
                }),
              )
            : null
          return {
            boutId: event.boutId,
            clientEventId: event.clientEventId,
            sequence: sequenceNo,
            eventType: event.eventType,
            entryId: event.entryId,
            cornerAtEvent: event.cornerAtEvent,
            points: event.points,
            episodeId: event.episodeId,
            boutElapsedMs: event.boutElapsedMs,
            period: event.period,
            attemptNumber: event.attemptNumber,
            payload: event.payload,
            createdAt: event.createdAt,
            eventStatus: reliability ? 'STAGED' : 'COMMITTED',
            eventHash,
            boutSessionId: reliability?.boutSessionId ?? null,
          }
        }),
      )

      if (reliability && result.createdEvents.length > 0) {
        const updated = await tx.boutSessionOwnership.updateMany({
          where: {
            boutSessionId: reliability.boutSessionId,
            expectedSequenceNo: reliability.sequenceNo,
          },
          data: {
            expectedSequenceNo: reliability.sequenceNo + result.createdEvents.length,
          },
        })
        if (updated.count !== 1) {
          const { ExpectedSequenceError } = await import('./mat-control/errors')
          throw new ExpectedSequenceError('Конфликт sequenceNo при записи события')
        }
      }

      await tx.boutScheduleExecution.update({
        where: { boutId: input.boutId },
        data: {
          ...mapExecutionToPrismaUpdate(result.execution),
          ...(execution.frozenScheduleFormatted
            ? {
                frozenScheduleFormatted: execution.frozenScheduleFormatted,
                frozenScheduleMatNumber: execution.frozenScheduleMatNumber,
                frozenSchedulePosition: execution.frozenSchedulePosition,
              }
            : {}),
        },
      })

      await updateMatControlSession(tx, matIndex, {
        activeBoutId: result.session.activeBoutId,
        revision: { increment: 1 },
      })

      if (input.intent === 'CONFIRM' && result.response.result) {
        const allEvents = [...events, ...result.createdEvents]
        await persistConfirmResult({
          tx,
          bout,
          execution: result.execution,
          events: allEvents,
          resultPayload: result.response.result as {
            winnerEntryId: string | null
            loserEntryId: string | null
            victoryMethod: string
            decisionReason: string
            decidedInPeriod: string
            officialEndedAt: string
            resultConfirmedAt: string
            confirmedBy?: string
          },
          durationOverrides: snapshot.settings.ageDivisionDurationOverrides,
        })
      }

      if (input.intent === 'RESET_BOUT') {
        const correctionMeta = await loadBoutCorrectionMeta(tx, bout)
        await persistBoutReset({
          tx,
          bout,
          correctionMeta,
          requestedBy: 'admin',
        })
      }

      const response = {
        ...result.response,
        liveRevision: result.execution.liveRevision,
        attemptNumber: result.execution.attemptNumber,
        boutPhase: result.execution.boutPhase,
      }

      await finalizeBoutControlCommand({
        tx,
        boutId: input.boutId,
        operationId: input.envelope.operationId,
        responseJson: response,
        createdEventIds,
      })

      return response
      },
      MAT_CONTROL_TRANSACTION_OPTIONS,
      )
    } catch (error) {
      const { CommandReservationRaceError } = await import('./mat-control/errors')
      if (error instanceof CommandReservationRaceError) {
        await sleep(25)
        continue
      }
      throw error
    }

    if (response !== null) {
      const { afterMatControlCommand } = await import('../announcer/hooks/afterMatCommand')
      void afterMatControlCommand({
        boutId: input.boutId,
        intent: input.intent,
        payload: input.payload,
      })
      return response
    }

    await sleep(25)
  }

  throw new Error('Command replay timeout')
}

export async function acquireMatSession(matIndex: number, holderToken: string) {
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    const session = await acquireMatControlSession({ tx, matIndex, holderToken, now })
    return { session, expiresAt: session.expiresAt?.toISOString() ?? null }
  }, MAT_CONTROL_TRANSACTION_OPTIONS)
}

export async function heartbeatMatSession(matIndex: number, holderToken: string) {
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    const session = await heartbeatMatControlSession({ tx, matIndex, holderToken, now })
    return { session, expiresAt: session.expiresAt?.toISOString() ?? null }
  }, MAT_CONTROL_TRANSACTION_OPTIONS)
}

export async function releaseMatSession(matIndex: number, holderToken: string) {
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    const session = await releaseMatControlSession({ tx, matIndex, holderToken, now })
    return { session }
  }, MAT_CONTROL_TRANSACTION_OPTIONS)
}

export async function takeoverMatSession(matIndex: number, holderToken: string) {
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    await lockMatControlSessionForUpdate(tx, matIndex)
    const session = await takeoverMatControlSession({ tx, matIndex, holderToken, now })
    return { session, expiresAt: session.expiresAt?.toISOString() ?? null }
  }, MAT_CONTROL_TRANSACTION_OPTIONS)
}

export async function executeCommitBoutPackage(input: {
  boutId: string
  package: {
    schemaVersion: number
    boutId: string
    boutSessionId: string
    clientSessionId: string
    ownershipEpoch: number
    events: Array<{
      schemaVersion: number
      type: string
      commandId: string
      sequenceNo: number
      boutElapsedMs: number
      payload: Record<string, unknown>
      eventHash: string
    }>
    result: Record<string, unknown>
    finalState: Record<string, unknown>
    packageHash?: string
  }
}) {
  const { commitBoutPackage } = await import('./matControlReliability/commitBoutPackage')
  const snapshot = await loadFullScheduleSnapshot(prisma, { adminPreview: true })
  const bout = snapshot.grouped.mats
    .flatMap((mat) => mat.bouts)
    .find((row) => row.id === input.boutId)
  if (!bout) {
    throw new Error('Bout not found')
  }

  return prisma.$transaction(async (tx) => {
    const executionRow = await tx.boutScheduleExecution.findUnique({
      where: { boutId: input.boutId },
    })
    if (!executionRow) {
      throw new Error('Execution row missing')
    }

    const events = (await loadBoutEvents(tx, input.boutId)).map(mapEventRow)
    const execution = mapExecutionRow(executionRow)
    const resultPayload = input.package.result as {
      winnerEntryId: string | null
      loserEntryId: string | null
      victoryMethod: string
      decisionReason: string
      decidedInPeriod: string
      officialEndedAt: string
      resultConfirmedAt: string
      confirmedBy?: string
      injuryScoreAcknowledged?: boolean
    }

    const { assertConfirmBoutValid } = await import('./confirmValidation')
    assertConfirmBoutValid({
      victoryMethod: resultPayload.victoryMethod as import('../config/fseRules').VictoryMethod,
      events,
      attemptNumber: execution.attemptNumber,
      period: execution.currentPeriod,
      injuryScoreAcknowledged: Boolean(resultPayload.injuryScoreAcknowledged),
    })

    const finalElapsedMs = input.package.finalState.boutElapsedMs
    if (typeof finalElapsedMs === 'number' && finalElapsedMs >= 0) {
      const lastElapsed = events
        .filter((event) => !event.undoneAt)
        .map((event) => event.boutElapsedMs ?? 0)
        .reduce((max, value) => Math.max(max, value), 0)
      if (Math.abs(lastElapsed - finalElapsedMs) > 2000) {
        throw new Error(
          `finalState.boutElapsedMs (${finalElapsedMs}) не совпадает с событиями (${lastElapsed})`,
        )
      }
    }

    const ack = await commitBoutPackage(tx, input.package)

    await persistConfirmResult({
      tx,
      bout,
      execution: {
        ...execution,
        boutPhase: 'confirmed',
        attemptNumber: execution.attemptNumber,
      },
      events,
      resultPayload,
      durationOverrides: snapshot.settings.ageDivisionDurationOverrides,
      skipBracketPromotion: true,
    })

    const { enqueueBracketUnlock } = await import('./matControlReliability/bracketUnlockOutbox')
    await enqueueBracketUnlock(tx, {
      boutId: input.boutId,
      boutSessionId: input.package.boutSessionId,
      categoryKey: bout.categoryKey,
      winnerEntryId: resultPayload.winnerEntryId,
      loserEntryId: resultPayload.loserEntryId,
      schedulePhase: bout.schedulePhase,
    })

    await tx.boutScheduleExecution.update({
      where: { boutId: input.boutId },
      data: { boutPhase: 'confirmed' },
    })

    return ack
  }, MAT_CONTROL_TRANSACTION_OPTIONS)
}
