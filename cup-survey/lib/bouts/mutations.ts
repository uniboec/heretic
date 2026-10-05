import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { lockBoutsPageSetting } from './locks'
import {
  BracketOperationError,
  DraftConflictError,
  VersionConflictError,
} from '../brackets/core/errors'
import { acquireBracketWriteLocks } from '../brackets/live/locks'
import { getCurrentPublishedDraws } from '../brackets/generation/publishedDraws'
import {
  applyFixedDemotion,
  buildFixedDemotionPlan,
  demotedFixedMatsFromEntries,
  hasDemotionConfirmation,
  lockActivePublishedGeneration,
  lockPublishedDrawRows,
  reassignReleasedMatAssignments,
} from './matCountChange'
import {
  BoutsValidationError,
  MatCountDemotionConfirmationRequiredError,
} from './errors'
import {
  getEffectiveAutoMatAssignMode,
  isCategoryBatchMode,
  isTimeWeightedMode,
  type AutoMatAssignMode,
} from './autoMatMode'
import { normalizeBoutsPageSettings } from './normalizeBoutsPageSettings'
import { loadScheduleSnapshot } from './scheduleService'
import { getGroupedBoutsForSchedule } from './schedulePipeline'
import {
  assertTimingSettingsNotFrozen,
  clearRemovedMatScheduleState,
  resolveTimingSettingsPatch,
} from './timingSettingsMutations'
import { reconcileMatControlSessionsAfterScheduleChange } from './matControlSession'
import { serializeMatStartTimeOverrides } from './startTimes.server'
import { serializeAgeDivisionDurationOverrides } from './boutDuration.server'
import { deepEqualJson } from './executionGuards'
import {
  assertBulkPinCascadeConfirmed,
  assertPinCascadeConfirmed,
  assertProposedScheduleStateAcyclic,
  buildProposedScheduleState,
  diffOverridesForMat,
  mergeCategoryScheduleOverrides,
  renumberManualOrderForMat,
} from './scheduleOverrideMutations'
import {
  clearManualOrderForMats,
  loadScheduleOverrideContext,
} from './manualOrderCleanup'
import { clearManualOrderForMat } from './scheduleOverrides'
import {
  ScheduleConstraintCycleError,
  CompetitionStageChangeForbiddenError,
  InvalidScheduleReorderError,
} from './errors'
import { assertCompetitionStageInRange } from './competitionStages'
import { canChangeCompetitionStage } from './competitionStageLifecycle'
import { normalizeCompetitionStageSettings } from './competitionStageSettings'
import { normalizeAthleteParticipationSpacing } from './athleteParticipationSpacing'
import { rebuildAndPersistScheduleWaves } from './boutScheduleWaves.server'
import { assertStageSettingsPatchAllowed } from './stageSettingsLock'
import { assertSameStageManualReorder } from './manualOrderValidation'
import { buildScheduledMats } from './scheduleService'
import {
  bumpScheduleVersionIfNeeded,
  runStructuralScheduleMutation,
} from './scheduleStructuralMutation'
import type {
  AdminBoutsSettingsPatchInput,
  MatCountChangeResult,
  ModeChangeResult,
} from './schemas'

function assertMatIndexValid(matIndex: number | null, matCount: number) {
  if (matIndex == null) return
  if (matIndex < 1 || matIndex > matCount) {
    throw new BracketOperationError(
      'INVALID_MAT_INDEX',
      `Площадка должна быть от 1 до ${matCount} или Auto`,
    )
  }
}

function mapSettingsResponse(settings: {
  publicEnabled: boolean
  matCount: number
  matsEnabled: boolean
  scheduleVersion: number
  autoMatAssignMode: AutoMatAssignMode
  autoMatByCategoryEnabled: boolean
  boutsStartTime: string
  matStartTimeOverrides: unknown
  boutBreakMinutes: number
  ageDivisionDurationOverrides: unknown
}) {
  const normalized = normalizeBoutsPageSettings(settings)
  return {
    publicEnabled: normalized.publicEnabled,
    matCount: normalized.matCount,
    matsEnabled: normalized.matsEnabled,
    scheduleVersion: normalized.scheduleVersion,
    autoMatAssignMode: normalized.autoMatAssignMode,
    autoMatByCategoryEnabled: normalized.autoMatByCategoryEnabled,
    boutsStartTime: normalized.boutsStartTime,
    matStartTimeOverrides: normalized.matStartTimeOverrides,
    boutBreakMinutes: normalized.boutBreakMinutes,
    ageDivisionDurationOverrides: normalized.ageDivisionDurationOverrides,
    pinAllFinalsToEnd: normalized.pinAllFinalsToEnd,
    competitionStageSettings: normalized.competitionStageSettings,
    athleteParticipationSpacing: normalized.athleteParticipationSpacing,
  }
}

function assertExpectedScheduleVersion(
  expectedScheduleVersion: number | undefined,
  message = 'Укажите expectedScheduleVersion',
) {
  if (expectedScheduleVersion === undefined) {
    throw new BoutsValidationError(message)
  }
}

function toPublicDemotionEntries(entries: Array<{ categoryKey: string; matIndex: number }>) {
  return entries.map(({ categoryKey, matIndex }) => ({ categoryKey, matIndex }))
}

export async function updateBoutsPageSettings(input: AdminBoutsSettingsPatchInput) {
  const result = await prisma.$transaction(
    async (tx) => {
      const lockedSettings = await lockBoutsPageSetting(tx)
      const normalizedSettings = normalizeBoutsPageSettings(lockedSettings)

      const matsEnabledChanged =
        input.matsEnabled !== undefined && input.matsEnabled !== lockedSettings.matsEnabled
      if (matsEnabledChanged) {
        if (input.expectedScheduleVersion === undefined) {
          throw new BoutsValidationError('Для изменения режима ковров укажите expectedScheduleVersion')
        }
        const frozenCount = await tx.boutScheduleExecution.count({
          where: { frozenScheduleFormatted: { not: null } },
        })
        if (frozenCount > 0) {
          throw new BoutsValidationError(
            'Режим ковров можно менять только до первого зафиксированного номера',
          )
        }
      }

      const matCountChanged =
        input.matCount !== undefined && input.matCount !== lockedSettings.matCount
      const storedModeChanged =
        input.autoMatAssignMode !== undefined &&
        input.autoMatAssignMode !== lockedSettings.autoMatAssignMode

      if (hasDemotionConfirmation(input) && !matCountChanged) {
        throw new BoutsValidationError(
          'Подтверждение demotion допустимо только при изменении числа площадок',
        )
      }

      const nextMarker =
        input.autoMatByCategoryEnabled ?? lockedSettings.autoMatByCategoryEnabled
      const nextStoredMode = input.autoMatAssignMode ?? lockedSettings.autoMatAssignMode
      if (
        !nextMarker &&
        input.autoMatAssignMode !== undefined &&
        isCategoryBatchMode(nextStoredMode)
      ) {
        throw new BracketOperationError(
          'AUTO_MAT_BY_CATEGORY_NOT_ENABLED',
          'Режим «категория на одной площадке» ещё не включён для этого окружения',
        )
      }

      if (matCountChanged) {
        return applyMatCountChange(tx, input, lockedSettings, matCountChanged, storedModeChanged)
      }

      const hasTimingPatch =
        input.boutsStartTime !== undefined ||
        input.matStartTimeOverrides !== undefined ||
        input.boutBreakMinutes !== undefined ||
        input.ageDivisionDurationOverrides !== undefined ||
        input.competitionStageSettings !== undefined
      const timingWriteData = await buildTimingSettingsWriteData(tx, lockedSettings, input)
      const timingResolved = hasTimingPatch
        ? resolveTimingSettingsPatch(lockedSettings, input)
        : null
      const nextSettingsPreview = {
        autoMatAssignMode: nextStoredMode,
        autoMatByCategoryEnabled: nextMarker,
        boutBreakMinutes: timingResolved?.boutBreakMinutes ?? lockedSettings.boutBreakMinutes,
        ageDivisionDurationOverrides:
          timingResolved?.ageDivisionDurationOverrides ??
          lockedSettings.ageDivisionDurationOverrides,
      }
      const previousEffective = getEffectiveAutoMatAssignMode(lockedSettings)
      const nextEffective = getEffectiveAutoMatAssignMode(nextSettingsPreview)
      const effectiveModeChanged = previousEffective !== nextEffective
      const beforeNormalized = normalizeBoutsPageSettings(lockedSettings)
      const afterNormalized = normalizeBoutsPageSettings({
        ...lockedSettings,
        ...nextSettingsPreview,
      })
      const timingWeightsChanged =
        isTimeWeightedMode(nextEffective) &&
        (beforeNormalized.boutBreakMinutes !== afterNormalized.boutBreakMinutes ||
          !deepEqualJson(
            beforeNormalized.ageDivisionDurationOverrides,
            afterNormalized.ageDivisionDurationOverrides,
          ))

      let modeChange: ModeChangeResult | null = null
      if (effectiveModeChanged || timingWeightsChanged) {
        const activePublished = await lockActivePublishedGeneration(tx)
        if (activePublished) {
          await lockPublishedDrawRows(tx, activePublished.id)
          const reassign = await reassignReleasedMatAssignments(
            tx,
            lockedSettings.matCount,
            activePublished,
            nextSettingsPreview,
          )
          if (reassign.recomputedReleasedCategoryCount > 0) {
            modeChange = reassign
          }
        }
      }

      const stageSettingsWriteData = await buildStageSettingsWriteData(
        tx,
        lockedSettings,
        input,
      )

      const pinAllFinalsChanged =
        input.pinAllFinalsToEnd !== undefined &&
        input.pinAllFinalsToEnd !== lockedSettings.pinAllFinalsToEnd
      const spacingChanged = input.athleteParticipationSpacing !== undefined
      const stageSettingsChanged = input.competitionStageSettings !== undefined
      const autoMatMarkerChanged =
        input.autoMatByCategoryEnabled !== undefined &&
        input.autoMatByCategoryEnabled !== lockedSettings.autoMatByCategoryEnabled
      const scheduleSnapshotChanged =
        matsEnabledChanged ||
        hasTimingPatch ||
        spacingChanged ||
        pinAllFinalsChanged ||
        stageSettingsChanged ||
        storedModeChanged ||
        autoMatMarkerChanged ||
        effectiveModeChanged ||
        timingWeightsChanged ||
        Boolean(modeChange && modeChange.recomputedReleasedCategoryCount > 0)

      let scheduleVersion = lockedSettings.scheduleVersion
      if (matsEnabledChanged) {
        assertExpectedScheduleVersion(
          input.expectedScheduleVersion,
          'Для изменения режима ковров укажите expectedScheduleVersion',
        )
        const versioned = await runStructuralScheduleMutation({
          tx,
          settings: normalizedSettings,
          expectedScheduleVersion: input.expectedScheduleVersion,
          changed: true,
          execute: async () => null,
        })
        scheduleVersion = versioned.scheduleVersion
      }

      const settings = await tx.boutsPageSetting.update({
        where: { id: 'default' },
        data: {
          ...(input.publicEnabled !== undefined ? { publicEnabled: input.publicEnabled } : {}),
          ...(matsEnabledChanged ? { matsEnabled: input.matsEnabled! } : {}),
          ...(storedModeChanged ? { autoMatAssignMode: input.autoMatAssignMode! } : {}),
          ...(input.autoMatByCategoryEnabled !== undefined
            ? { autoMatByCategoryEnabled: input.autoMatByCategoryEnabled }
            : {}),
          ...(input.pinAllFinalsToEnd !== undefined
            ? { pinAllFinalsToEnd: input.pinAllFinalsToEnd }
            : {}),
          ...(input.athleteParticipationSpacing !== undefined
            ? {
                athleteParticipationSpacing: normalizeAthleteParticipationSpacing(
                  input.athleteParticipationSpacing,
                ),
              }
            : {}),
          ...timingWriteData,
          ...stageSettingsWriteData,
        },
      })

      if (input.athleteParticipationSpacing !== undefined) {
        const grouped = await getGroupedBoutsForSchedule(tx, settings.matCount, {
          adminPreview: true,
        })
        const snapshot = await loadScheduleSnapshot(tx)
        await rebuildAndPersistScheduleWaves(tx, {
          grouped,
          settings: normalizeBoutsPageSettings(settings),
          scheduleOverrides: snapshot.scheduleOverrides,
        })
      }

      if (scheduleSnapshotChanged && !matsEnabledChanged) {
        assertExpectedScheduleVersion(input.expectedScheduleVersion)
        scheduleVersion = await bumpScheduleVersionIfNeeded(
          tx,
          input.expectedScheduleVersion!,
          true,
        )
      }

      return {
        ok: true as const,
        settings: mapSettingsResponse(settings),
        matCountChange: null,
        modeChange,
        ...(scheduleSnapshotChanged ? { scheduleVersion } : {}),
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  )
  if ('scheduleVersion' in result && result.scheduleVersion !== undefined) {
    const { scheduleMatAnnouncerSync } = await import('../announcer/hooks/scheduleMatSync')
    scheduleMatAnnouncerSync()
  }
  return result
}

async function buildStageSettingsWriteData(
  tx: Prisma.TransactionClient,
  lockedSettings: Awaited<ReturnType<typeof lockBoutsPageSetting>>,
  input: AdminBoutsSettingsPatchInput,
) {
  if (input.competitionStageSettings === undefined) {
    return {}
  }

  const before = normalizeBoutsPageSettings(lockedSettings)
  const afterSettings = normalizeCompetitionStageSettings(input.competitionStageSettings)
  const grouped = await getGroupedBoutsForSchedule(tx, lockedSettings.matCount, {
    adminPreview: true,
  })
  const snapshot = await loadScheduleSnapshot(tx)
  const { mats } = buildScheduledMats({
    grouped,
    snapshot: {
      ...snapshot,
      settings: before,
    },
    now: new Date(),
  })

  assertStageSettingsPatchAllowed({
    oldSettings: before.competitionStageSettings,
    newSettings: afterSettings,
    allBouts: mats.flatMap((mat) => mat.bouts),
    executions: snapshot.executions,
    boutsStartTimeChanged: false,
    boutBreakMinutesChanged: false,
  })

  return { competitionStageSettings: afterSettings }
}

async function buildTimingSettingsWriteData(
  tx: Prisma.TransactionClient,
  lockedSettings: Awaited<ReturnType<typeof lockBoutsPageSetting>>,
  input: AdminBoutsSettingsPatchInput,
) {
  const hasTimingPatch =
    input.boutsStartTime !== undefined ||
    input.matStartTimeOverrides !== undefined ||
    input.boutBreakMinutes !== undefined ||
    input.ageDivisionDurationOverrides !== undefined

  if (!hasTimingPatch) {
    return {}
  }

  const timingPatch = resolveTimingSettingsPatch(lockedSettings, input)
  const grouped = await getGroupedBoutsForSchedule(tx, lockedSettings.matCount, {
    adminPreview: true,
  })
  const snapshot = await loadScheduleSnapshot(tx)
  const before = normalizeBoutsPageSettings(lockedSettings)
  const afterNormalized = normalizeBoutsPageSettings({
    ...lockedSettings,
    boutsStartTime: timingPatch.boutsStartTime,
    matStartTimeOverrides: timingPatch.matStartTimeOverrides,
    boutBreakMinutes: timingPatch.boutBreakMinutes,
    ageDivisionDurationOverrides: timingPatch.ageDivisionDurationOverrides,
  })
  const { mats } = buildScheduledMats({
    grouped,
    snapshot: { ...snapshot, settings: before },
    now: new Date(),
  })

  assertStageSettingsPatchAllowed({
    oldSettings: before.competitionStageSettings,
    newSettings: before.competitionStageSettings,
    allBouts: mats.flatMap((mat) => mat.bouts),
    executions: snapshot.executions,
    boutsStartTimeChanged: before.boutsStartTime !== afterNormalized.boutsStartTime,
    boutBreakMinutesChanged: before.boutBreakMinutes !== afterNormalized.boutBreakMinutes,
  })

  assertTimingSettingsNotFrozen({
    before: normalizeBoutsPageSettings(lockedSettings),
    after: normalizeBoutsPageSettings({
      ...lockedSettings,
      boutsStartTime: timingPatch.boutsStartTime,
      matStartTimeOverrides: timingPatch.matStartTimeOverrides,
      boutBreakMinutes: timingPatch.boutBreakMinutes,
      ageDivisionDurationOverrides: timingPatch.ageDivisionDurationOverrides,
    }),
    executions: snapshot.executions,
    mats: grouped.mats,
  })

  return {
    boutsStartTime: timingPatch.boutsStartTime,
    boutBreakMinutes: timingPatch.boutBreakMinutes,
    ...(timingPatch.matStartTimeOverridesWrite !== undefined
      ? { matStartTimeOverrides: timingPatch.matStartTimeOverridesWrite }
      : {}),
    ...(timingPatch.ageDivisionDurationOverridesWrite !== undefined
      ? { ageDivisionDurationOverrides: timingPatch.ageDivisionDurationOverridesWrite }
      : {}),
  }
}

async function applyMatCountChange(
  tx: Prisma.TransactionClient,
  input: AdminBoutsSettingsPatchInput,
  lockedSettings: Awaited<ReturnType<typeof lockBoutsPageSetting>>,
  matCountChanged: true,
  modeChanged: boolean,
) {
  const ctx = await acquireBracketWriteLocks(tx, { scope: 'minimal' })
  const activeDraft = ctx.generation
  if (input.draftId !== activeDraft.id) {
    throw new DraftConflictError()
  }
  if (input.expectedVersion !== activeDraft.version) {
    throw new VersionConflictError()
  }

  const activePublished = await lockActivePublishedGeneration(tx)
  if (activePublished) {
    await lockPublishedDrawRows(tx, activePublished.id)
  }

  const newMatCount = input.matCount!
  const draftDraws = await tx.bracketCategoryDraw.findMany({
    where: { generationId: activeDraft.id },
  })
  const publishedPairs = activePublished
    ? await getCurrentPublishedDraws({ db: tx, activeGeneration: activePublished })
    : []

  const plan = buildFixedDemotionPlan({
    draftId: activeDraft.id,
    draftVersion: activeDraft.version,
    activePublishedGenerationId: activePublished?.id ?? null,
    newMatCount,
    draftDraws,
    publishedPairs,
  })

  const needsDemotion = plan.draftEntries.length + plan.publishedEntries.length > 0
  if (input.demotionToken && input.demotionToken !== plan.demotionToken) {
    throw new MatCountDemotionConfirmationRequiredError({
      demotionToken: plan.demotionToken,
      demotedFixedMats: demotedFixedMatsFromEntries(plan.draftEntries, plan.publishedEntries),
      demotedCategoryCount: plan.draftEntries.length + plan.publishedEntries.length,
      draftEntries: toPublicDemotionEntries(plan.draftEntries),
      publishedEntries: toPublicDemotionEntries(plan.publishedEntries),
    })
  }
  if (needsDemotion) {
    const confirmed =
      input.confirmFixedDemotion === true &&
      Boolean(input.demotionToken?.length) &&
      input.demotionToken === plan.demotionToken
    if (!confirmed) {
      throw new MatCountDemotionConfirmationRequiredError({
        demotionToken: plan.demotionToken,
        demotedFixedMats: demotedFixedMatsFromEntries(plan.draftEntries, plan.publishedEntries),
        demotedCategoryCount: plan.draftEntries.length + plan.publishedEntries.length,
        draftEntries: toPublicDemotionEntries(plan.draftEntries),
        publishedEntries: toPublicDemotionEntries(plan.publishedEntries),
      })
    }
  }

  await applyFixedDemotion(tx, plan.draftEntries, plan.publishedEntries)

  const nextMode = input.autoMatAssignMode ?? lockedSettings.autoMatAssignMode
  const timingPatch = resolveTimingSettingsPatch(lockedSettings, input)
  const grouped = await getGroupedBoutsForSchedule(tx, lockedSettings.matCount, {
    adminPreview: true,
  })
  const snapshot = await loadScheduleSnapshot(tx)

  const prunedOverrides = await clearRemovedMatScheduleState(tx, {
    oldMatCount: lockedSettings.matCount,
    newMatCount,
    matStartTimeOverrides: timingPatch.matStartTimeOverrides,
    mats: grouped.mats,
    executions: snapshot.executions,
  })

  assertTimingSettingsNotFrozen({
    before: normalizeBoutsPageSettings(lockedSettings),
    after: normalizeBoutsPageSettings({
      ...lockedSettings,
      matCount: newMatCount,
      boutsStartTime: timingPatch.boutsStartTime,
      matStartTimeOverrides: prunedOverrides,
      boutBreakMinutes: timingPatch.boutBreakMinutes,
      ageDivisionDurationOverrides: timingPatch.ageDivisionDurationOverrides,
    }),
    executions: snapshot.executions,
    mats: grouped.mats.filter((mat) => mat.matIndex <= newMatCount),
  })

  const settings = await tx.boutsPageSetting.update({
    where: { id: 'default' },
    data: {
      matCount: newMatCount,
      ...(input.publicEnabled !== undefined ? { publicEnabled: input.publicEnabled } : {}),
      ...(modeChanged ? { autoMatAssignMode: nextMode } : {}),
      boutsStartTime: timingPatch.boutsStartTime,
      boutBreakMinutes: timingPatch.boutBreakMinutes,
      matStartTimeOverrides: serializeMatStartTimeOverrides(prunedOverrides),
      ageDivisionDurationOverrides: serializeAgeDivisionDurationOverrides(
        timingPatch.ageDivisionDurationOverrides,
      ),
    },
  })

  let matCountChange: MatCountChangeResult = {
    recomputedReleasedCategoryCount: 0,
    reassignedAutoCategoryCount: 0,
    demotedFixedMats: demotedFixedMatsFromEntries(plan.draftEntries, plan.publishedEntries),
    demotedCategoryCount: plan.draftEntries.length + plan.publishedEntries.length,
  }

  if (activePublished) {
    const reassign = await reassignReleasedMatAssignments(
      tx,
      newMatCount,
      activePublished,
      settings,
    )
    matCountChange = {
      ...reassign,
      demotedFixedMats: matCountChange.demotedFixedMats,
      demotedCategoryCount: matCountChange.demotedCategoryCount,
    }
  }

  const regrouped = await getGroupedBoutsForSchedule(tx, newMatCount, { adminPreview: true })
  const boutIdToMatIndex = new Map<string, number>()
  for (const mat of regrouped.mats) {
    for (const bout of mat.bouts) {
      boutIdToMatIndex.set(bout.id, mat.matIndex)
    }
  }
  await reconcileMatControlSessionsAfterScheduleChange(tx, {
    matCount: newMatCount,
    boutIdToMatIndex,
  })

  await tx.bracketGeneration.update({
    where: { id: activeDraft.id },
    data: { version: activeDraft.version + 1 },
  })

  assertExpectedScheduleVersion(input.expectedScheduleVersion)
  const versioned = await runStructuralScheduleMutation({
    tx,
    settings: normalizeBoutsPageSettings(lockedSettings),
    expectedScheduleVersion: input.expectedScheduleVersion,
    changed: true,
    execute: async () => null,
  })

  return {
    ok: true as const,
    settings: mapSettingsResponse(settings),
    draft: { id: activeDraft.id, version: activeDraft.version + 1 },
    matCountChange,
    modeChange: null,
    scheduleVersion: versioned.scheduleVersion,
  }
}

export async function updateBracketDrawMatIndex(input: {
  drawId: string
  draftId: string
  expectedVersion: number
  matIndex: number | null
}) {
  return prisma.$transaction(
    async (tx) => {
      const ctx = await acquireBracketWriteLocks(tx, {
        scope: 'minimal',
        categoryKeys: undefined,
      })
      if (ctx.generation.id !== input.draftId || ctx.generation.version !== input.expectedVersion) {
        throw new DraftConflictError()
      }
      const draw = await tx.bracketCategoryDraw.findUnique({ where: { id: input.drawId } })
      if (!draw || draw.generationId !== ctx.generation.id) {
        throw new DraftConflictError()
      }

      await tx.$executeRaw`
        SELECT id FROM "BracketCategoryDraw"
        WHERE id = ${input.drawId}
        FOR UPDATE
      `

      const lockedSettings = ctx.boutsSettings
      assertMatIndexValid(input.matIndex, lockedSettings.matCount)

      const groupedBefore = await getGroupedBoutsForSchedule(tx, lockedSettings.matCount, {
        adminPreview: true,
      })
      const oldMatIndex = groupedBefore.mats.find((mat) =>
        mat.bouts.some((bout) => bout.categoryKey === draw.categoryKey),
      )?.matIndex

      await tx.bracketCategoryDraw.update({
        where: { id: draw.id },
        data: { matIndex: input.matIndex },
      })

      const matsToClear = [oldMatIndex, input.matIndex].filter(
        (index): index is number => typeof index === 'number' && index > 0,
      )
      await clearManualOrderForMats(tx, matsToClear)

      await tx.bracketGeneration.update({
        where: { id: ctx.generation.id },
        data: { version: ctx.generation.version + 1 },
      })

      return {
        ok: true as const,
        draw: { id: draw.id, matIndex: input.matIndex },
        draft: { id: ctx.generation.id, version: ctx.generation.version + 1 },
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  )
}

async function persistCategoryOverrides(
  tx: Prisma.TransactionClient,
  pairs: Awaited<ReturnType<typeof import('../brackets/generation/publishedDraws').getCurrentPublishedDraws>>,
  categoryOverrides: Map<string, import('./scheduleOverrides').BoutScheduleOverrides>,
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

export async function updateMatManualOrder(input: {
  matIndex: number
  orderedBoutIds: string[]
  expectedScheduleVersion: number
}) {
  const result = await prisma.$transaction(async (tx) => {
    const { grouped, pairs, overrides, settings } = await loadScheduleOverrideContext(tx)
    const mat = grouped.mats.find((entry) => entry.matIndex === input.matIndex)
    if (!mat) {
      throw new BoutsValidationError('Ковёр не найден в текущем расписании')
    }
    const matIds = new Set(mat.bouts.map((bout) => bout.id))
    if (
      input.orderedBoutIds.length !== mat.bouts.length ||
      !input.orderedBoutIds.every((id) => matIds.has(id))
    ) {
      throw new BoutsValidationError('orderedBoutIds должен содержать все бои ковра')
    }

    assertSameStageManualReorder(input.orderedBoutIds, mat.bouts)

    const nextOverrides = renumberManualOrderForMat(mat.bouts, input.orderedBoutIds, overrides)
    const proposed = buildProposedScheduleState({
      groupedMats: grouped.mats,
      overrides: nextOverrides,
      settings,
    })
    try {
      assertProposedScheduleStateAcyclic(proposed)
    } catch (error) {
      if (error instanceof ScheduleConstraintCycleError) {
        throw new BoutsValidationError(error.message)
      }
      throw error
    }

    const byCategory = diffOverridesForMat(mat.bouts, overrides, nextOverrides)
    const versioned = await runStructuralScheduleMutation({
      tx,
      settings,
      expectedScheduleVersion: input.expectedScheduleVersion,
      execute: async () => {
        await persistCategoryOverrides(tx, pairs, byCategory)
        return { ok: true as const }
      },
    })
    return { ok: true as const, scheduleVersion: versioned.scheduleVersion }
  })
  const { scheduleMatAnnouncerSync } = await import('../announcer/hooks/scheduleMatSync')
  scheduleMatAnnouncerSync()
  return result
}

export async function resetMatManualOrder(input: {
  matIndex: number
  expectedScheduleVersion: number
}) {
  const result = await prisma.$transaction(async (tx) => {
    const { grouped, pairs, overrides, settings } = await loadScheduleOverrideContext(tx)
    const mat = grouped.mats.find((entry) => entry.matIndex === input.matIndex)
    if (!mat) {
      throw new BoutsValidationError('Ковёр не найден в текущем расписании')
    }
    const nextOverrides = clearManualOrderForMat(mat.bouts, overrides)
    const byCategory = diffOverridesForMat(mat.bouts, overrides, nextOverrides)
    const versioned = await runStructuralScheduleMutation({
      tx,
      settings,
      expectedScheduleVersion: input.expectedScheduleVersion,
      execute: async () => {
        await persistCategoryOverrides(tx, pairs, byCategory)
        return { ok: true as const }
      },
    })
    return { ok: true as const, scheduleVersion: versioned.scheduleVersion }
  })
  const { scheduleMatAnnouncerSync } = await import('../announcer/hooks/scheduleMatSync')
  scheduleMatAnnouncerSync()
  return result
}

function applyPinnedToEndOverride(
  overrides: import('./scheduleOverrides').BoutScheduleOverrides,
  boutId: string,
  pinnedToEnd: boolean,
): import('./scheduleOverrides').BoutScheduleOverrides {
  const next = {
    ...overrides,
    [boutId]: {
      ...overrides[boutId],
      pinnedToEnd: pinnedToEnd ? true : undefined,
    },
  }
  if (!pinnedToEnd && next[boutId]) {
    const { pinnedToEnd: _removed, ...rest } = next[boutId]!
    if (Object.keys(rest).length === 0) delete next[boutId]
    else next[boutId] = rest
  }
  return next
}

export async function setBoutPinnedToEnd(input: {
  boutId: string
  pinnedToEnd: boolean
  confirmCascade?: boolean
  expectedScheduleVersion: number
}) {
  return setBoutsPinnedToEnd({
    boutIds: [input.boutId],
    pinnedToEnd: input.pinnedToEnd,
    confirmCascade: input.confirmCascade,
    expectedScheduleVersion: input.expectedScheduleVersion,
  })
}

export async function setBoutsPinnedToEnd(input: {
  boutIds: string[]
  pinnedToEnd: boolean
  confirmCascade?: boolean
  expectedScheduleVersion: number
}) {
  const uniqueBoutIds = [...new Set(input.boutIds)]
  if (uniqueBoutIds.length === 0) {
    throw new BoutsValidationError('Выберите поединки для закрепления')
  }

  const result = await prisma.$transaction(async (tx) => {
    const { grouped, pairs, overrides, settings } = await loadScheduleOverrideContext(tx)
    const allBouts = grouped.mats.flatMap((mat) => mat.bouts)
    const selectedBouts = uniqueBoutIds.map((boutId) => {
      const bout = allBouts.find((entry) => entry.id === boutId)
      if (!bout) {
        throw new BoutsValidationError('Бой не найден в текущем расписании')
      }
      return bout
    })

    assertBulkPinCascadeConfirmed({
      boutIds: uniqueBoutIds,
      pinnedToEnd: input.pinnedToEnd,
      confirmCascade: input.confirmCascade,
      allBouts,
      overrides,
    })

    let nextOverrides = overrides
    for (const boutId of uniqueBoutIds) {
      nextOverrides = applyPinnedToEndOverride(nextOverrides, boutId, input.pinnedToEnd)
    }

    const proposed = buildProposedScheduleState({
      groupedMats: grouped.mats,
      overrides: nextOverrides,
      settings,
    })
    try {
      assertProposedScheduleStateAcyclic(proposed)
    } catch (error) {
      if (error instanceof ScheduleConstraintCycleError) {
        throw new BoutsValidationError(error.message)
      }
      throw error
    }

    const byCategory = diffOverridesForMat(selectedBouts, overrides, nextOverrides)
    const versioned = await runStructuralScheduleMutation({
      tx,
      settings,
      expectedScheduleVersion: input.expectedScheduleVersion,
      execute: async () => {
        await persistCategoryOverrides(tx, pairs, byCategory)
        return { ok: true as const, boutIds: uniqueBoutIds }
      },
    })
    return { ok: true as const, boutIds: uniqueBoutIds, scheduleVersion: versioned.scheduleVersion }
  })
  const { scheduleMatAnnouncerSync } = await import('../announcer/hooks/scheduleMatSync')
  scheduleMatAnnouncerSync()
  return result
}

export async function updateBracketDrawCompetitionStage(input: {
  drawId: string
  draftId: string
  expectedVersion: number
  expectedScheduleVersion?: number
  competitionStage: number
}) {
  return prisma.$transaction(
    async (tx) => {
      const ctx = await acquireBracketWriteLocks(tx, {
        scope: 'minimal',
        categoryKeys: undefined,
      })
      if (ctx.generation.id !== input.draftId || ctx.generation.version !== input.expectedVersion) {
        throw new DraftConflictError()
      }
      const draw = await tx.bracketCategoryDraw.findUnique({ where: { id: input.drawId } })
      if (!draw || draw.generationId !== ctx.generation.id) {
        throw new DraftConflictError()
      }

      await tx.$executeRaw`
        SELECT id FROM "BracketCategoryDraw"
        WHERE id = ${input.drawId}
        FOR UPDATE
      `

      assertCompetitionStageInRange(input.competitionStage)

      if (draw.competitionStage === input.competitionStage) {
        return {
          ok: true as const,
          draw: { id: draw.id, competitionStage: draw.competitionStage },
          draft: { id: ctx.generation.id, version: ctx.generation.version },
        }
      }

      const grouped = await getGroupedBoutsForSchedule(tx, ctx.boutsSettings.matCount, {
        adminPreview: true,
      })
      const snapshot = await loadScheduleSnapshot(tx)
      const { mats } = buildScheduledMats({
        grouped,
        snapshot,
        now: new Date(),
      })
      const allBouts = mats.flatMap((mat) => mat.bouts)
      const executions = new Map(
        snapshot.executions.map((execution) => [execution.boutId, execution]),
      )
      const categoryBouts = grouped.mats
        .flatMap((mat) => mat.bouts)
        .filter((b) => b.categoryKey === draw.categoryKey)

      if (
        !canChangeCompetitionStage({
          categoryBouts,
          targetStage: input.competitionStage,
          snapshot: { allBouts, executions },
        })
      ) {
        throw new CompetitionStageChangeForbiddenError()
      }

      const oldStage = draw.competitionStage
      const oldMatIndex = grouped.mats.find((mat) =>
        mat.bouts.some((bout) => bout.categoryKey === draw.categoryKey),
      )?.matIndex

      await tx.bracketCategoryDraw.update({
        where: { id: draw.id },
        data: { competitionStage: input.competitionStage },
      })

      if (oldMatIndex != null) {
        const { clearManualOrderForCategoryStageChange } = await import('./manualOrderCleanup')
        await clearManualOrderForCategoryStageChange(tx, {
          categoryKey: draw.categoryKey,
          oldStage,
          newStage: input.competitionStage,
          matIndex: oldMatIndex,
        })
      }

      await tx.bracketGeneration.update({
        where: { id: ctx.generation.id },
        data: { version: ctx.generation.version + 1 },
      })

      assertExpectedScheduleVersion(input.expectedScheduleVersion)
      const versioned = await bumpScheduleVersionIfNeeded(
        tx,
        input.expectedScheduleVersion!,
        true,
      )

      return {
        ok: true as const,
        draw: { id: draw.id, competitionStage: input.competitionStage },
        draft: { id: ctx.generation.id, version: ctx.generation.version + 1 },
        scheduleVersion: versioned,
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  )
}
