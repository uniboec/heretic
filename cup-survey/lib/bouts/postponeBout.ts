import { prisma } from '../prisma'
import { runStructuralScheduleMutation } from './scheduleStructuralMutation'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { lockMatScheduleRuntimeRows } from './locks'
import { diffOverridesForMat, mergeCategoryScheduleOverrides } from './scheduleOverrideMutations'
import { loadScheduleOverrideContext } from './manualOrderCleanup'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import { BoutsValidationError } from './errors'
import { AttemptMismatchError, StaleLiveRevisionError } from './mat-control/errors'
import { assertMatControlLease, lockMatControlSessionForUpdate } from './matControlSession'
import { resolveMatIndexFromBout } from './resolveMatIndexFromBout'
import { buildMatScheduleEntries } from './matControlContext'
import { isAthleteParticipationSpacingEnabled } from './athleteParticipationSpacing'
import { resolveOrderedMatBoutsForRuntime } from './loadRuntimeMatOrders'
import {
  applyMatQueueAfterOnRuntimeOrder,
  stabilizeMatQueueAfterOverrides,
  stabilizeMatQueueAfterOverridesAsync,
} from './matRuntimeOrder'
import {
  assertCascadeBeforeAnchor,
  assertRunnableOrderRespectsSportDependencies,
  buildPostponeCascadeOverrides,
  collectMatPostponeCascadeBoutIds,
  filterCascadeForPostponeAnchor,
  resolveNextActiveBoutAfterPostpone,
} from './postponeCascade'
import { listRunnableMatBoutIds, resolvePostponeAnchorId } from './resolvePostponeAnchor'
import { updateMatControlSession } from './matControlSession'

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

function assertPostponeExecutionGuards(
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

export async function postponeBoutOnMat(input: {
  boutId: string
  postponeAfterBoutId?: string
  postponeBy?: number
  holderToken: string
  expectedLiveRevision: number
  expectedAttemptNumber: number
  expectedScheduleVersion: number
  reason?: string
  postponedBy?: string
}) {
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const { grouped, pairs, overrides, settings } = await loadScheduleOverrideContext(tx)
    const scheduleEntries = buildMatScheduleEntries(grouped)
    const matIndex = resolveMatIndexFromBout(input.boutId, scheduleEntries)

    await lockMatScheduleRuntimeRows(tx, [matIndex])
    const session = await lockMatControlSessionForUpdate(tx, matIndex)
    assertMatControlLease(session, input.holderToken, now)

    const mat = grouped.mats.find((entry) => entry.matIndex === matIndex)
    if (!mat) {
      throw new BoutsValidationError('Ковёр не найден')
    }

    const bout = mat.bouts.find((entry) => entry.id === input.boutId)
    if (!bout) {
      throw new BoutsValidationError('Поединок не найден на ковре')
    }

    const matBoutIds = mat.bouts.map((entry) => entry.id)
    const executionRows = await tx.boutScheduleExecution.findMany({
      where: { boutId: { in: matBoutIds } },
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

    assertPostponeExecutionGuards(
      executionByBoutId.get(input.boutId),
      input.expectedLiveRevision,
      input.expectedAttemptNumber,
    )

    const spacingEnabled = isAthleteParticipationSpacingEnabled(settings.athleteParticipationSpacing)
    const omitActiveBoutIds = spacingEnabled ? new Set([input.boutId]) : undefined
    const { orderedMatBouts } = await resolveOrderedMatBoutsForRuntime({
      groupedMats: grouped.mats,
      matIndex,
      overrides,
      settings,
      now,
      db: tx,
      omitActiveBoutIds,
    })
    const orderedMatBoutIds = orderedMatBouts.map((entry) => entry.id)
    const runnableMatBoutIds = listRunnableMatBoutIds(orderedMatBoutIds, completedBoutIds)

    const preliminaryCascadeBoutIds = collectMatPostponeCascadeBoutIds({
      rootBoutId: input.boutId,
      matBouts: mat.bouts,
      completedBoutIds,
      runnableMatBoutIds,
      overrides,
    })

    let postponeAfterBoutId =
      input.postponeAfterBoutId ??
      (input.postponeBy != null
        ? resolvePostponeAnchorId(
            runnableMatBoutIds,
            input.boutId,
            input.postponeBy,
            new Set(preliminaryCascadeBoutIds),
          )
        : null)
    if (!postponeAfterBoutId) {
      throw new BoutsValidationError('Укажите, через сколько поединков перенести')
    }

    const cascadeBoutIds = filterCascadeForPostponeAnchor({
      cascadeBoutIds: preliminaryCascadeBoutIds,
      rootBoutId: input.boutId,
      postponeAfterBoutId,
      overrides,
      groupedMats: grouped.mats,
      matIndex,
      settings,
      matBouts: mat.bouts,
      runnableMatBoutIds,
      completedBoutIds,
      orderedMatBoutsBefore: orderedMatBouts,
    })

    if (input.postponeAfterBoutId == null && input.postponeBy != null) {
      postponeAfterBoutId = resolvePostponeAnchorId(
        runnableMatBoutIds,
        input.boutId,
        input.postponeBy,
        new Set(cascadeBoutIds),
      )
    }
    const cascadeBoutIdSet = new Set(cascadeBoutIds)

    if (completedBoutIds.has(postponeAfterBoutId)) {
      throw new BoutsValidationError('Нельзя перенести после завершённого поединка')
    }
    if (cascadeBoutIdSet.has(postponeAfterBoutId)) {
      throw new BoutsValidationError('Нельзя ставить якорь переноса на зависимый поединок')
    }

    const anchorIndex = runnableMatBoutIds.indexOf(postponeAfterBoutId)
    const boutIndex = runnableMatBoutIds.indexOf(input.boutId)
    if (anchorIndex < 0) {
      throw new BoutsValidationError('Якорный поединок не найден в очереди ковра')
    }
    if (boutIndex < 0) {
      throw new BoutsValidationError('Поединок не найден в очереди ковра')
    }
    assertCascadeBeforeAnchor({
      rootBoutId: input.boutId,
      runnableMatBoutIds,
      anchorIndex,
    })

    for (const boutId of cascadeBoutIds) {
      const execution = executionByBoutId.get(boutId)
      if (execution && execution.boutPhase !== 'scheduled') {
        throw new BoutsValidationError(
          'Перенос с зависимыми поединками доступен только пока все они в подготовке',
        )
      }
    }

    const cascadeOverrides = buildPostponeCascadeOverrides({
      rootBoutId: input.boutId,
      cascadeBoutIds,
      postponeAfterBoutId,
      overrides,
      matBouts: mat.bouts,
      runnableMatBoutIds,
      completedBoutIds,
    })

    const loadPersistedOrder = async (overrideSet: BoutScheduleOverrides) => {
      const { orderedMatBouts: resolved } = await resolveOrderedMatBoutsForRuntime({
        groupedMats: grouped.mats,
        matIndex,
        overrides: overrideSet,
        settings,
        now,
        db: tx,
        omitActiveBoutIds,
      })
      return resolved
    }

    let nextOverrides = cascadeOverrides
    let persistedOrder = await loadPersistedOrder(nextOverrides)
    let runnableAfterIds = listRunnableMatBoutIds(
      persistedOrder.map((entry) => entry.id),
      completedBoutIds,
    )
    let nextBoutIndex = runnableAfterIds.indexOf(input.boutId)

    if (nextBoutIndex <= boutIndex) {
      const orderedAfter = applyMatQueueAfterOnRuntimeOrder(orderedMatBouts, cascadeOverrides)
      nextOverrides = spacingEnabled
        ? await stabilizeMatQueueAfterOverridesAsync({
            groupedMats: grouped.mats,
            matIndex,
            settings,
            targetOrder: orderedAfter,
            overrides: cascadeOverrides,
            resolveColdOrder: loadPersistedOrder,
          })
        : stabilizeMatQueueAfterOverrides({
            groupedMats: grouped.mats,
            matIndex,
            settings,
            targetOrder: orderedAfter,
            overrides: cascadeOverrides,
          })
      persistedOrder = await loadPersistedOrder(nextOverrides)
      runnableAfterIds = listRunnableMatBoutIds(
        persistedOrder.map((entry) => entry.id),
        completedBoutIds,
      )
      nextBoutIndex = runnableAfterIds.indexOf(input.boutId)
    }

    if (nextBoutIndex <= boutIndex) {
      throw new BoutsValidationError('Не удалось изменить порядок поединка в очереди ковра')
    }
    assertRunnableOrderRespectsSportDependencies({
      matBouts: mat.bouts,
      runnableBoutIds: runnableAfterIds,
      completedBoutIds,
    })

    const byCategory = diffOverridesForMat(mat.bouts, overrides, nextOverrides)
    if (byCategory.size === 0) {
      throw new BoutsValidationError('Не удалось сохранить перенос поединка')
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

    const restRows = await tx.athleteRestState.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const restUntilByEntryId = new Map(
      restRows
        .filter((row) => !row.invalidatedAt)
        .map((row) => [row.entryId, row.restUntil]),
    )

    const nextActiveBoutId = resolveNextActiveBoutAfterPostpone({
      orderedBouts: persistedOrder,
      cascadeBoutIdSet,
      completedBoutIds,
      restUntilByEntryId,
      now,
      skipRestBlocks: spacingEnabled,
    })

    await updateMatControlSession(tx, matIndex, {
      activeBoutId: nextActiveBoutId,
      revision: { increment: 1 },
    })

    return {
      ok: true,
      boutId: input.boutId,
      postponeAfterBoutId,
      cascadeBoutIds,
      nextActiveBoutId,
      runnableMatBoutIds: runnableAfterIds,
      reason: input.reason ?? null,
      postponedBy: input.postponedBy ?? null,
      postponedAt: now.toISOString(),
      scheduleVersion: versioned.scheduleVersion,
    }
  })

  const { scheduleMatAnnouncerSync } = await import('../announcer/hooks/scheduleMatSync')
  scheduleMatAnnouncerSync()
  return result
}
