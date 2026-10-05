import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { getCorrectionImpactAdapter } from '../brackets/correctionImpact'
import { reconcileCategoryPublishedStructure } from '../brackets/reconcilePublishedStructure'
import { computeRequestFingerprint } from './computeRequestFingerprint'
import {
  getBlockingDownstreamExecutions,
  getCurrentBoutResult,
  invalidateAthleteRestForBouts,
  listBoutResultVersions,
} from './boutResultQueries'
import { resetBoutExecutionForRerun } from './resetBoutExecutionForRerun'
import { resetScheduledExecutionAfterParticipantChange } from './resetScheduledExecutionAfterParticipantChange'
import { mapExecutionRow, mapEventRow } from './matControlMappers'
import { loadBoutEvents } from './matControlContext'
import { lockCompetitionDrawForCategory } from './lockCompetitionForBout'
import { CorrectionBlockedError, IdempotencyKeyReusedError } from './mat-control/errors'
import { resolveEffectiveBoutStoppage } from './resolveEffectiveBoutStoppage'
import { wasFightClockStarted } from '../fastestFights/fightClockStarted'
import { resolveFastestFightBoutResultFields } from '../fastestFights/resolveFastestFightBoutResultFields'

export async function previewBoutResultCorrection(input: {
  boutId: string
  newWinnerEntryId: string | null
  systemId: string
  categoryKey: string
  downstreamBoutIds: string[]
}) {
  const current = await getCurrentBoutResult(prisma, input.boutId)
  const adapter = getCorrectionImpactAdapter(input.systemId)
  const preview = adapter.preview({
    sourceBoutId: input.boutId,
    categoryKey: input.categoryKey,
    systemId: input.systemId,
    previousWinnerEntryId: current?.winnerEntryId ?? null,
    newWinnerEntryId: input.newWinnerEntryId,
    downstreamBoutIds: input.downstreamBoutIds,
  })

  const blocking = await getBlockingDownstreamExecutions(prisma, input.downstreamBoutIds)
  if (blocking.length > 0) {
    return {
      ...preview,
      blocked: true,
      blockingBoutIds: blocking.map((row) => row.boutId),
    }
  }

  return { ...preview, blocked: false, blockingBoutIds: [] as string[] }
}

function hasPreFightEvents(events: ReturnType<typeof mapEventRow>[]): boolean {
  return events.some(
    (event) =>
      !event.undoneAt &&
      (event.eventType === 'FIRST_CALL' ||
        event.eventType === 'SECONDARY_CALL' ||
        event.eventType === 'CLOCK_START'),
  )
}

export async function applyBoutResultCorrection(input: {
  boutId: string
  operationId: string
  reason: string
  requestedBy: string
  newWinnerEntryId: string | null
  newLoserEntryId: string | null
  systemId: string
  categoryKey: string
  schedulePhase: 'elimination' | 'bronze' | 'final' | 'round_robin'
  downstreamBoutIds: string[]
}) {
  const fingerprint = computeRequestFingerprint('RESULT_CORRECTION_APPLY', {
    newWinnerEntryId: input.newWinnerEntryId,
    newLoserEntryId: input.newLoserEntryId,
    reason: input.reason,
  })

  const existing = await prisma.resultCorrectionCase.findUnique({
    where: {
      sourceBoutId_operationId: {
        sourceBoutId: input.boutId,
        operationId: input.operationId,
      },
    },
  })
  if (existing) {
    if (existing.requestFingerprint !== fingerprint) {
      throw new IdempotencyKeyReusedError()
    }
    return existing
  }

  return prisma.$transaction(async (tx) => {
    await lockCompetitionDrawForCategory(tx, input.categoryKey)

    const current = await getCurrentBoutResult(tx, input.boutId)
    const adapter = getCorrectionImpactAdapter(input.systemId)
    const preview = adapter.preview({
      sourceBoutId: input.boutId,
      categoryKey: input.categoryKey,
      systemId: input.systemId,
      previousWinnerEntryId: current?.winnerEntryId ?? null,
      newWinnerEntryId: input.newWinnerEntryId,
      downstreamBoutIds: input.downstreamBoutIds,
    })

    const blocking = await getBlockingDownstreamExecutions(tx, input.downstreamBoutIds)
    if (blocking.length > 0) {
      throw new CorrectionBlockedError(blocking.map((row) => row.boutId))
    }

    if (preview.correctionMode === 'METADATA_ONLY' && current) {
      const updated = await tx.boutResult.update({
        where: { id: current.id },
        data: {
          decisionReason: input.reason,
          decisionDetails: {
            ...(typeof current.decisionDetails === 'object' && current.decisionDetails
              ? current.decisionDetails
              : {}),
            correctedAt: new Date().toISOString(),
            correctedBy: input.requestedBy,
          },
        },
      })

      return tx.resultCorrectionCase.create({
        data: {
          tournamentScopeId: TOURNAMENT_SCOPE_ID,
          sourceBoutId: input.boutId,
          operationId: input.operationId,
          requestFingerprint: fingerprint,
          correctionMode: preview.correctionMode,
          reason: input.reason,
          requestedBy: input.requestedBy,
          appliedBy: input.requestedBy,
          appliedAt: new Date(),
          previousSourceResultJson: current,
          newSourceResultJson: updated,
          invalidatedBoutIds: [],
          affectedBoutIds: [input.boutId],
        },
      })
    }

    if (current) {
      await tx.boutResult.update({
        where: { id: current.id },
        data: {
          isCurrent: false,
          resultStatus: 'INVALIDATED',
          invalidatedAt: new Date(),
          invalidatedBy: input.requestedBy,
          invalidationReason: input.reason,
        },
      })
    }

    const sourceExecution = await tx.boutScheduleExecution.findUnique({
      where: { boutId: input.boutId },
    })
    const sourceEvents = sourceExecution
      ? (await loadBoutEvents(tx, input.boutId)).map(mapEventRow)
      : []

    if (preview.correctionMode === 'BRANCH_RECOVERY') {
      await tx.boutResult.updateMany({
        where: { boutId: { in: preview.invalidatedBoutIds }, isCurrent: true },
        data: {
          isCurrent: false,
          resultStatus: 'INVALIDATED',
          invalidatedAt: new Date(),
          invalidatedBy: input.requestedBy,
          invalidationReason: input.reason,
        },
      })
    }

    await invalidateAthleteRestForBouts(tx, [
      input.boutId,
      ...preview.invalidatedBoutIds,
    ])

    for (const downstreamBoutId of preview.invalidatedBoutIds) {
      const execution = await tx.boutScheduleExecution.findUnique({
        where: { boutId: downstreamBoutId },
      })
      if (!execution) continue

      const mapped = mapExecutionRow(execution)
      const reset =
        preview.correctionMode === 'SAFE_CASCADE' && hasPreFightEvents(sourceEvents)
          ? resetScheduledExecutionAfterParticipantChange(mapped)
          : resetBoutExecutionForRerun(mapped)

      await tx.boutScheduleExecution.update({
        where: { boutId: downstreamBoutId },
        data: {
          boutPhase: reset.boutPhase,
          clockState: reset.clockState,
          currentPeriod: reset.currentPeriod,
          activityCorrectionMode: reset.activityCorrectionMode,
          periodCorrectionMode: reset.periodCorrectionMode,
          actualStartAt: reset.actualStartAt,
          actualEndAt: reset.actualEndAt,
          officialStartedAt: reset.officialStartedAt,
          officialEndedAt: reset.officialEndedAt,
          mainEndedAt: reset.mainEndedAt,
          extraEndedAt: reset.extraEndedAt,
          clockStartedAt: reset.clockStartedAt,
          clockElapsedBeforeStartMs: reset.clockElapsedBeforeStartMs,
          liveSnapshot: reset.liveSnapshot as Prisma.InputJsonValue,
          attemptNumber: reset.attemptNumber,
          liveRevision: reset.liveRevision,
        },
      })
    }

    if (sourceExecution) {
      const mapped = mapExecutionRow(sourceExecution)
      const reset = resetBoutExecutionForRerun(mapped)
      await tx.boutScheduleExecution.update({
        where: { boutId: input.boutId },
        data: {
          boutPhase: reset.boutPhase,
          clockState: reset.clockState,
          currentPeriod: reset.currentPeriod,
          activityCorrectionMode: reset.activityCorrectionMode,
          periodCorrectionMode: reset.periodCorrectionMode,
          actualStartAt: reset.actualStartAt,
          actualEndAt: reset.actualEndAt,
          officialStartedAt: reset.officialStartedAt,
          officialEndedAt: reset.officialEndedAt,
          mainEndedAt: reset.mainEndedAt,
          extraEndedAt: reset.extraEndedAt,
          clockStartedAt: reset.clockStartedAt,
          clockElapsedBeforeStartMs: reset.clockElapsedBeforeStartMs,
          liveSnapshot: reset.liveSnapshot as Prisma.InputJsonValue,
          attemptNumber: reset.attemptNumber,
          liveRevision: reset.liveRevision,
        },
      })
    }

    const versions = await listBoutResultVersions(tx, input.boutId)
    const nextVersion = (versions[0]?.resultVersion ?? 0) + 1
    const victoryMethod = current?.victoryMethod ?? 'POINTS'
    const fastestFightFields = resolveFastestFightBoutResultFields(
      victoryMethod,
      resolveEffectiveBoutStoppage(sourceEvents),
      { fightOfficiallyStarted: wasFightClockStarted(sourceEvents) },
    )

    await tx.boutResult.create({
      data: {
        boutId: input.boutId,
        resultVersion: nextVersion,
        isCurrent: true,
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        winnerEntryId: input.newWinnerEntryId,
        loserEntryId: input.newLoserEntryId,
        victoryMethod,
        decisionReason: input.reason,
        decidedInPeriod: current?.decidedInPeriod ?? 'main',
        mainRedScore: current?.mainRedScore ?? 0,
        mainBlueScore: current?.mainBlueScore ?? 0,
        extraRedScore: current?.extraRedScore,
        extraBlueScore: current?.extraBlueScore,
        officialEndedAt: current?.officialEndedAt ?? new Date(),
        resultConfirmedAt: new Date(),
        boutElapsedMs: fastestFightFields.boutElapsedMs,
        fightOfficiallyStarted: wasFightClockStarted(sourceEvents),
        stoppageTrigger: fastestFightFields.stoppageTrigger,
        stoppageEventId: fastestFightFields.stoppageEventId,
        confirmedBy: input.requestedBy,
        attemptNumber: (sourceExecution?.attemptNumber ?? 1) + 1,
        resultStatus: 'ACTIVE',
      },
    })

    await reconcileCategoryPublishedStructure(tx, input.categoryKey)

    return tx.resultCorrectionCase.create({
      data: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        sourceBoutId: input.boutId,
        operationId: input.operationId,
        requestFingerprint: fingerprint,
        correctionMode: preview.correctionMode,
        reason: input.reason,
        requestedBy: input.requestedBy,
        appliedBy: input.requestedBy,
        appliedAt: new Date(),
        previousSourceResultJson: current ?? {},
        newSourceResultJson: {
          winnerEntryId: input.newWinnerEntryId,
          loserEntryId: input.newLoserEntryId,
        },
        invalidatedBoutIds: preview.invalidatedBoutIds,
        affectedBoutIds: preview.affectedBoutIds,
      },
    })
  })
}
