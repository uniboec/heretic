import { prisma } from '../prisma'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { lockMatScheduleRuntimeRows } from './locks'
import { diffOverridesForMat, mergeCategoryScheduleOverrides } from './scheduleOverrideMutations'
import { loadScheduleOverrideContext } from './manualOrderCleanup'
import { BoutsValidationError } from './errors'
import { AttemptMismatchError, StaleLiveRevisionError } from './mat-control/errors'
import {
  assertMatControlLease,
  lockMatControlSessionForUpdate,
  reconcileMatControlSessionsAfterScheduleChange,
  updateMatControlSession,
} from './matControlSession'
import { buildMatScheduleEntries } from './matControlContext'
import { isAthleteParticipationSpacingEnabled } from './athleteParticipationSpacing'
import { resolveOrderedMatBoutsForRuntime } from './loadRuntimeMatOrders'
import {
  assertRunnableOrderRespectsSportDependencies,
  collectMatPostponeCascadeBoutIds,
  resolveNextActiveBoutAfterPostpone,
} from './postponeCascade'
import { listRunnableMatBoutIds } from './resolvePostponeAnchor'
import { finalizeGroupedWithScheduleOverrides } from './schedulePipeline'
import { applyCrossMatMoveOverrides } from './scheduleMoveBoutsToMat'

async function persistCategoryOverrides(
  tx: Parameters<typeof loadScheduleOverrideContext>[0],
  pairs: Awaited<ReturnType<typeof loadScheduleOverrideContext>>['pairs'],
  categoryOverrides: Map<string, Record<string, unknown>>,
) {
  for (const pair of pairs) {
    const patch = categoryOverrides.get(pair.draw.categoryKey)
    if (!patch) continue
    const merged = mergeCategoryScheduleOverrides(pair.publicationState.scheduleOverrides, patch)
    await tx.bracketPublicationState.update({
      where: { categoryKey: pair.draw.categoryKey },
      data: { scheduleOverrides: merged },
    })
  }
}

function assertMoveExecutionGuards(
  execution: { boutPhase: string; liveRevision: number; attemptNumber: number } | undefined,
  expectedLiveRevision: number,
  expectedAttemptNumber: number,
): void {
  if (execution && execution.boutPhase !== 'scheduled') {
    throw new BoutsValidationError('Перенос доступен только для поединка в подготовке')
  }
  if (!execution) return

  if (execution.attemptNumber !== expectedAttemptNumber) {
    throw new AttemptMismatchError()
  }
  if (execution.liveRevision !== expectedLiveRevision) {
    throw new StaleLiveRevisionError()
  }
}

export async function moveBoutToMat(input: {
  boutId: string
  targetMatIndex: number
  holderToken: string
  expectedLiveRevision: number
  expectedAttemptNumber: number
  reason?: string
  movedBy?: string
}) {
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const { grouped, pairs, overrides, settings } = await loadScheduleOverrideContext(tx)
    const scheduleEntries = buildMatScheduleEntries(grouped)
    const sourceMatIndex = scheduleEntries.find((entry) => entry.boutId === input.boutId)?.matIndex
    if (sourceMatIndex == null) {
      throw new BoutsValidationError('Поединок не найден в расписании')
    }
    if (input.targetMatIndex === sourceMatIndex) {
      throw new BoutsValidationError('Выберите другой ковёр')
    }
    if (input.targetMatIndex < 1 || input.targetMatIndex > settings.matCount) {
      throw new BoutsValidationError('Ковёр не найден')
    }
    if (settings.matCount <= 1) {
      throw new BoutsValidationError('Нет других ковров для переноса')
    }

    const sourceMat = grouped.mats.find((entry) => entry.matIndex === sourceMatIndex)
    const targetMat = grouped.mats.find((entry) => entry.matIndex === input.targetMatIndex)
    if (!sourceMat || !targetMat) {
      throw new BoutsValidationError('Ковёр не найден')
    }

    await lockMatScheduleRuntimeRows(tx, [sourceMatIndex, input.targetMatIndex])
    const session = await lockMatControlSessionForUpdate(tx, sourceMatIndex)
    assertMatControlLease(session, input.holderToken, now)

    const bout = sourceMat.bouts.find((entry) => entry.id === input.boutId)
    if (!bout) {
      throw new BoutsValidationError('Поединок не найден на ковре')
    }

    const sourceMatBoutIds = sourceMat.bouts.map((entry) => entry.id)
    const executionRows = await tx.boutScheduleExecution.findMany({
      where: { boutId: { in: sourceMatBoutIds } },
      select: {
        boutId: true,
        actualEndAt: true,
        boutPhase: true,
        liveRevision: true,
        attemptNumber: true,
      },
    })
    const completedBoutIds = new Set(
      executionRows.filter((row) => row.actualEndAt != null).map((row) => row.boutId),
    )
    const executionByBoutId = new Map(executionRows.map((row) => [row.boutId, row]))

    assertMoveExecutionGuards(
      executionByBoutId.get(input.boutId),
      input.expectedLiveRevision,
      input.expectedAttemptNumber,
    )

    const spacingEnabled = isAthleteParticipationSpacingEnabled(settings.athleteParticipationSpacing)
    const { orderedMatBouts: sourceOrderedBefore } = await resolveOrderedMatBoutsForRuntime({
      groupedMats: grouped.mats,
      matIndex: sourceMatIndex,
      overrides,
      settings,
      now,
      db: tx,
    })
    const runnableSourceIds = listRunnableMatBoutIds(
      sourceOrderedBefore.map((entry) => entry.id),
      completedBoutIds,
    )

    const cascadeBoutIds = collectMatPostponeCascadeBoutIds({
      rootBoutId: input.boutId,
      matBouts: sourceMat.bouts,
      completedBoutIds,
      runnableMatBoutIds: runnableSourceIds,
      overrides,
    })
    const cascadeBoutIdSet = new Set(cascadeBoutIds)

    for (const boutId of cascadeBoutIds) {
      const execution = executionByBoutId.get(boutId)
      if (execution && execution.boutPhase !== 'scheduled') {
        throw new BoutsValidationError(
          'Перенос с зависимыми поединками доступен только пока все они в подготовке',
        )
      }
    }

    const nextOverrides = applyCrossMatMoveOverrides({
      overrides,
      cascadeBoutIds,
      targetMatIndex: input.targetMatIndex,
    })
    const finalized = finalizeGroupedWithScheduleOverrides(
      grouped,
      nextOverrides,
      settings.matCount,
    )

    const movedOnTarget = finalized.grouped.mats
      .find((mat) => mat.matIndex === input.targetMatIndex)
      ?.bouts.filter((entry) => cascadeBoutIdSet.has(entry.id))
      .map((entry) => entry.id)
    if (!movedOnTarget || movedOnTarget.length !== cascadeBoutIds.length) {
      throw new BoutsValidationError('Не удалось перенести поединок на выбранный ковёр')
    }

    const { orderedMatBouts: targetOrdered } = await resolveOrderedMatBoutsForRuntime({
      groupedMats: finalized.grouped,
      matIndex: input.targetMatIndex,
      overrides: finalized.overrides,
      settings,
      now,
      db: tx,
    })
    const targetRunnableIds = listRunnableMatBoutIds(
      targetOrdered.map((entry) => entry.id),
      completedBoutIds,
    )
    const finalizedTargetMat = finalized.grouped.mats.find(
      (mat) => mat.matIndex === input.targetMatIndex,
    )
    assertRunnableOrderRespectsSportDependencies({
      matBouts: finalizedTargetMat?.bouts ?? [],
      runnableBoutIds: targetRunnableIds,
      completedBoutIds,
    })

    const finalizedSourceMat = finalized.grouped.mats.find(
      (mat) => mat.matIndex === sourceMatIndex,
    )
    const affectedBouts = [
      ...(finalizedSourceMat?.bouts ?? []),
      ...(finalizedTargetMat?.bouts ?? []),
    ]
    const byCategory = diffOverridesForMat(affectedBouts, overrides, finalized.overrides)
    if (byCategory.size === 0) {
      throw new BoutsValidationError('Не удалось сохранить перенос поединка')
    }
    await persistCategoryOverrides(tx, pairs, byCategory)

    const restRows = await tx.athleteRestState.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const restUntilByEntryId = new Map(
      restRows
        .filter((row) => !row.invalidatedAt)
        .map((row) => [row.entryId, row.restUntil]),
    )

    const { orderedMatBouts: sourceOrderedAfter } = await resolveOrderedMatBoutsForRuntime({
      groupedMats: finalized.grouped,
      matIndex: sourceMatIndex,
      overrides: finalized.overrides,
      settings,
      now,
      db: tx,
    })

    const nextActiveBoutId = resolveNextActiveBoutAfterPostpone({
      orderedBouts: sourceOrderedAfter,
      cascadeBoutIdSet,
      completedBoutIds,
      restUntilByEntryId,
      now,
      skipRestBlocks: spacingEnabled,
    })

    if (session.activeBoutId && cascadeBoutIdSet.has(session.activeBoutId)) {
      await updateMatControlSession(tx, sourceMatIndex, {
        activeBoutId: nextActiveBoutId,
        revision: { increment: 1 },
      })
    }

    const boutIdToMatIndex = new Map<string, number>()
    for (const mat of finalized.grouped.mats) {
      for (const entry of mat.bouts) {
        boutIdToMatIndex.set(entry.id, mat.matIndex)
      }
    }
    await reconcileMatControlSessionsAfterScheduleChange(tx, {
      matCount: settings.matCount,
      boutIdToMatIndex,
    })

    return {
      ok: true,
      boutId: input.boutId,
      sourceMatIndex,
      targetMatIndex: input.targetMatIndex,
      cascadeBoutIds,
      nextActiveBoutId,
      reason: input.reason ?? null,
      movedBy: input.movedBy ?? null,
      movedAt: now.toISOString(),
    }
  })

  const { scheduleMatAnnouncerSync } = await import('../announcer/hooks/scheduleMatSync')
  scheduleMatAnnouncerSync()
  return result
}
