import { prisma } from '../prisma'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { lockMatScheduleRuntimeRows } from './locks'
import { runStructuralScheduleMutation } from './scheduleStructuralMutation'
import { buildScheduleDisplayMetaByBoutId } from './buildScheduleDisplayByBoutId'
import { assertCrossMatMoveAllowed } from './scheduleZoneValidation'
import { buildScheduledMats, loadScheduleSnapshot } from './scheduleService'
import { diffOverridesForMat, mergeCategoryScheduleOverrides } from './scheduleOverrideMutations'
import { loadScheduleOverrideContext } from './manualOrderCleanup'
import { BoutsValidationError } from './errors'
import { buildMatScheduleEntries } from './matControlContext'
import { isAthleteParticipationSpacingEnabled } from './athleteParticipationSpacing'
import { resolveOrderedMatBoutsForRuntime } from './loadRuntimeMatOrders'
import {
  assertRunnableOrderRespectsSportDependencies,
  collectMatPostponeCascadeBoutIds,
  resolveNextActiveBoutAfterPostpone,
} from './postponeCascade'
import { listRunnableMatBoutIds } from './resolvePostponeAnchor'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import { finalizeGroupedWithScheduleOverrides } from './schedulePipeline'
import {
  lockMatControlSessionForUpdate,
  reconcileMatControlSessionsAfterScheduleChange,
  updateMatControlSession,
} from './matControlSession'

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

export function stripMatQueueFields(
  override: BoutScheduleOverrides[string] | undefined,
): BoutScheduleOverrides[string] {
  if (!override) return {}
  const { queueAfterBoutId: _queue, manualOrder: _manual, ...rest } = override
  return rest
}

export function applyCrossMatMoveOverrides(input: {
  overrides: BoutScheduleOverrides
  cascadeBoutIds: readonly string[]
  targetMatIndex: number
}): BoutScheduleOverrides {
  const next = { ...input.overrides }
  for (const boutId of input.cascadeBoutIds) {
    next[boutId] = {
      ...stripMatQueueFields(next[boutId]),
      assignedMatIndex: input.targetMatIndex,
    }
  }
  return next
}

function assertScheduleMoveExecution(
  execution: { boutPhase: string; actualEndAt: Date | null } | undefined,
  boutId: string,
): void {
  if (execution?.actualEndAt != null) {
    throw new BoutsValidationError('Перенос недоступен для завершённых поединков')
  }
  if (execution && execution.boutPhase !== 'scheduled') {
    throw new BoutsValidationError(
      `Перенос доступен только для поединков в очереди (бой ${boutId})`,
    )
  }
}

export async function moveBoutsToMatOnSchedule(input: {
  boutIds: string[]
  targetMatIndex: number
  expectedScheduleVersion: number
}) {
  const uniqueBoutIds = [...new Set(input.boutIds)]
  if (uniqueBoutIds.length === 0) {
    throw new BoutsValidationError('Выберите поединки для переноса')
  }

  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const { grouped, pairs, overrides, settings } = await loadScheduleOverrideContext(tx)
    if (settings.matCount <= 1) {
      throw new BoutsValidationError('Нет других ковров для переноса')
    }
    if (input.targetMatIndex < 1 || input.targetMatIndex > settings.matCount) {
      throw new BoutsValidationError('Ковёр не найден')
    }

    const scheduleEntries = buildMatScheduleEntries(grouped)
    const matIndexByBoutId = new Map(scheduleEntries.map((entry) => [entry.boutId, entry.matIndex]))
    const scheduleSnapshot = await loadScheduleSnapshot(tx)
    const scheduledBefore = buildScheduledMats({
      grouped,
      snapshot: scheduleSnapshot,
      now,
    })
    const displayMeta = buildScheduleDisplayMetaByBoutId(scheduledBefore.mats)
    const sourceMatIndexes = new Set<number>()

    for (const boutId of uniqueBoutIds) {
      const sourceMatIndex = matIndexByBoutId.get(boutId)
      if (sourceMatIndex == null) {
        throw new BoutsValidationError('Поединок не найден в расписании')
      }
      if (sourceMatIndex === input.targetMatIndex) {
        throw new BoutsValidationError('Выберите другой ковёр для переноса')
      }
      assertCrossMatMoveAllowed({
        sourceBoutId: boutId,
        destinationMatIndex: input.targetMatIndex,
        displayByBoutId: displayMeta,
        sourceMatIndex,
      })
      sourceMatIndexes.add(sourceMatIndex)
    }

    const allMovedBoutIds = new Set<string>()
    const movedBySourceMat = new Map<number, Set<string>>()

    const executionRows = await tx.boutScheduleExecution.findMany({
      where: { boutId: { in: [...new Set(grouped.mats.flatMap((mat) => mat.bouts.map((b) => b.id)))] } },
      select: {
        boutId: true,
        actualEndAt: true,
        boutPhase: true,
      },
    })
    const executionByBoutId = new Map(executionRows.map((row) => [row.boutId, row]))
    const completedBoutIds = new Set(
      executionRows.filter((row) => row.actualEndAt != null).map((row) => row.boutId),
    )

    for (const boutId of uniqueBoutIds) {
      assertScheduleMoveExecution(executionByBoutId.get(boutId), boutId)
      const sourceMatIndex = matIndexByBoutId.get(boutId)!
      const sourceMat = grouped.mats.find((entry) => entry.matIndex === sourceMatIndex)
      if (!sourceMat) {
        throw new BoutsValidationError('Ковёр не найден')
      }

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
        rootBoutId: boutId,
        matBouts: sourceMat.bouts,
        completedBoutIds,
        runnableMatBoutIds: runnableSourceIds,
        overrides,
      })

      for (const cascadeId of cascadeBoutIds) {
        const execution = executionByBoutId.get(cascadeId)
        assertScheduleMoveExecution(execution, cascadeId)
        allMovedBoutIds.add(cascadeId)
        const cascadeSourceMat = matIndexByBoutId.get(cascadeId) ?? sourceMatIndex
        const sourceSet = movedBySourceMat.get(cascadeSourceMat) ?? new Set<string>()
        sourceSet.add(cascadeId)
        movedBySourceMat.set(cascadeSourceMat, sourceSet)
      }
    }

    const matsToLock = [...sourceMatIndexes, input.targetMatIndex]
    await lockMatScheduleRuntimeRows(tx, matsToLock)

    const nextOverrides = applyCrossMatMoveOverrides({
      overrides,
      cascadeBoutIds: [...allMovedBoutIds],
      targetMatIndex: input.targetMatIndex,
    })
    const finalized = finalizeGroupedWithScheduleOverrides(
      grouped,
      nextOverrides,
      settings.matCount,
    )

    const finalizedTargetMat = finalized.grouped.mats.find(
      (mat) => mat.matIndex === input.targetMatIndex,
    )
    const movedOnTarget = finalizedTargetMat?.bouts
      .filter((entry) => allMovedBoutIds.has(entry.id))
      .map((entry) => entry.id)
    if (!movedOnTarget || movedOnTarget.length !== allMovedBoutIds.size) {
      throw new BoutsValidationError('Не удалось перенести поединки на выбранный ковёр')
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
    assertRunnableOrderRespectsSportDependencies({
      matBouts: finalizedTargetMat?.bouts ?? [],
      runnableBoutIds: targetRunnableIds,
      completedBoutIds,
    })

    const affectedBouts = finalized.grouped.mats
      .filter((mat) => matsToLock.includes(mat.matIndex))
      .flatMap((mat) => mat.bouts)
    const byCategory = diffOverridesForMat(affectedBouts, overrides, finalized.overrides)
    if (byCategory.size === 0) {
      throw new BoutsValidationError('Не удалось сохранить перенос поединков')
    }
    const versioned = await runStructuralScheduleMutation({
      tx,
      settings,
      expectedScheduleVersion: input.expectedScheduleVersion,
      execute: async () => {
        await persistCategoryOverrides(tx, pairs, byCategory)
        return { ok: true as const }
      },
    })

    const spacingEnabled = isAthleteParticipationSpacingEnabled(settings.athleteParticipationSpacing)
    const restRows = await tx.athleteRestState.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const restUntilByEntryId = new Map(
      restRows
        .filter((row) => !row.invalidatedAt)
        .map((row) => [row.entryId, row.restUntil]),
    )

    for (const sourceMatIndex of sourceMatIndexes) {
      const movedFromMat = movedBySourceMat.get(sourceMatIndex) ?? new Set<string>()
      if (movedFromMat.size === 0) continue

      const session = await lockMatControlSessionForUpdate(tx, sourceMatIndex)
      if (!session.activeBoutId || !movedFromMat.has(session.activeBoutId)) {
        continue
      }

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
        cascadeBoutIdSet: movedFromMat,
        completedBoutIds,
        restUntilByEntryId,
        now,
        skipRestBlocks: spacingEnabled,
      })

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
      boutIds: uniqueBoutIds,
      movedBoutIds: [...allMovedBoutIds],
      targetMatIndex: input.targetMatIndex,
      movedAt: now.toISOString(),
      scheduleVersion: versioned.scheduleVersion,
    }
  })

  const { scheduleMatAnnouncerSync } = await import('../announcer/hooks/scheduleMatSync')
  scheduleMatAnnouncerSync()
  return result
}
