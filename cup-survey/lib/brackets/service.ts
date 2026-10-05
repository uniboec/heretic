import type { OlympicBronzeMode } from '@prisma/client'
import { prisma } from '../prisma'
import {
  CHAMPION_SINGLETON_FORMAT_RULE,
  DEFAULT_FORMAT_RULES,
} from './defaultFormatRules'
import { computeDraftDiff } from './core/diff'
import { BracketOperationError, DraftConflictError, VersionConflictError } from './core/errors'
import { toBracketParticipantInput } from './core/seeding/participantMeta'
import { recomputeDrawFingerprints } from './core/seeding/recomputeDrawInput'
import {
  validateParticipantSeedUpdatesWithLocks,
} from './core/seeding/validateSeeds'
import { loadEligibleEntries } from './core/eligibility'
import { validateEntireRuleSet } from './core/formatRules'
import { acquireBracketWriteLocks } from './live/locks'
import { getEffectiveBronzeMode, getEffectiveSystemId, resolveCategoryFormat } from './core/formatRules'
import { getCategoryTitleFromKey } from '../registration/categoryIdentity'
import { compareBracketCategoryKeys } from '../registration/categoryRules'
import { getSystemForDraw } from './core/recalculate'
import {
  buildDrawBalanceReportFromParticipants,
  computeBalanceDelta,
} from './core/drawBalanceHelpers'
import { readPublishedStructure } from './core/readPublishedStructure'
import { readCategoryResult } from './core/readCategoryResult'
import { buildBoutOutcomesMap, collectCategoryBoutIds } from './buildBoutOutcomes'
import { listActiveBoutResultsForBoutIds } from '../bouts/boutResultQueries'
import { recomputeDrawStructure } from './generation/recomputeDrawStructure'
import { getUnresolvedAutoSyncFailures } from './generation/autoSyncEvents'
import {
  loadPublicationStateMap,
  publicationStateForCategory,
} from './generation/publicationState'
import {
  getActivePublishedGeneration,
  getPublicVisiblePublishedDraws,
} from './generation/publishedDraws'
import { ensureDraftExists } from './generation/ensureDraft'
import { resolvePublicGeneration, resolveWorkingDraftGeneration } from './live/generation'
import { syncBracketDraft } from './generation/sync'
import { redrawBracketDraft } from './generation/redraw'
import { publishBracketDraft } from './generation/publish'
import { moveBracketEntry, resetBracketEntryPlacement } from './placements'
import './systems'
import {
  buildAdminCategoryStructure,
  mapAdminCategoryMetadata,
  type DraftCategory,
} from './admin/mapCategoryMetadata'
import { isIndependentBoutsReleaseEnabled } from '../bouts/config'
import { getBoutsPageSettings } from '../bouts/service'
import { setCategoriesBoutsReleased } from '../bouts/release'

import type { EligibleEntry } from './core/types'
import { maybeLazyReconcileCategoryPublishedStructure } from './lazyReconcilePublishedStructure'

/** Public reads may reconcile many visible categories in one pass. */
const LAZY_RECONCILE_TX_OPTIONS = { timeout: 60_000 } as const
import {
  buildFilterCategories,
  buildPublicResultRows,
  buildPublicResultsStats,
  type PublicResultCategorySource,
  type PublicResultFilterCategorySource,
} from './publicResults'

export async function getAdminLiveCategoryStructure(categoryKey: string) {
  const published = await getActivePublishedGeneration()
  if (!published) return null

  await prisma.$transaction(async (tx) => {
    await maybeLazyReconcileCategoryPublishedStructure(tx, categoryKey)
  }, LAZY_RECONCILE_TX_OPTIONS)

  const pair = await prisma.bracketCategoryDraw.findFirst({
    where: { generationId: published.id, categoryKey, status: 'ACTIVE' },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
  })
  if (!pair || pair.participants.length === 0) return null

  const effectiveBronzeMode = getEffectiveBronzeMode(pair.autoBronzeMode, pair.bronzeModeOverride)
  const effectiveSystemId = getEffectiveSystemId(pair.autoSystemId, pair.systemOverride)

  const structure = readPublishedStructure({
    publishedStructureJson: pair.publishedStructureJson,
    autoSystemId: pair.autoSystemId,
    systemOverride: pair.systemOverride,
    systemVersion: pair.systemVersion,
    autoBronzeMode: pair.autoBronzeMode,
    bronzeModeOverride: pair.bronzeModeOverride,
    drawSeed: pair.drawSeed,
    participants: pair.participants,
    effectiveBronzeMode,
  })

  const categoryMeta = {
    categoryKey: pair.categoryKey,
    categoryTitle: getCategoryTitleFromKey(pair.categoryKey),
    discipline: pair.discipline,
    storedMatIndex: pair.matIndex,
    competitionStage: pair.competitionStage,
  }

  const boutIds = structure ? collectCategoryBoutIds(structure, categoryMeta) : []
  const activeResults = await listActiveBoutResultsForBoutIds(prisma, boutIds)

  return {
    categoryKey: pair.categoryKey,
    effectiveSystemId,
    effectiveBronzeMode,
    structure,
    result: readCategoryResult(structure, effectiveSystemId, {
      participantCount: pair.participants.length,
      bronzeMode: effectiveBronzeMode,
    }),
    boutOutcomes: structure ? buildBoutOutcomesMap(activeResults) : {},
    isLive: true as const,
    participants: pair.participants.map((p) => ({
      entryId: p.entryId,
      seedPosition: p.seedPosition,
      seedLocked: p.seedLocked,
      displayName: p.snapshotDisplayName ?? '',
      clubName: p.snapshotClubName ?? '',
      city: p.snapshotCity ?? '',
    })),
  }
}

export async function getAdminBracketCategoryStructure(categoryKey: string) {
  await ensureDraftExists()

  const working = await resolveWorkingDraftGeneration()
  if (!working) return null

  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { generationId: working.id, categoryKey },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
  })
  if (!draw || draw.participants.length === 0) {
    return null
  }

  const settings = await getBracketPageSettings()
  const eligible = await loadEligibleEntries({
    includePaid: settings.includePaid,
    includeUnpaid: settings.includeUnpaid,
  })
  const eligibleMap = new Map(eligible.map((e) => [e.entryId, e]))
  const effectiveBronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
  const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)

  return {
    categoryKey: draw.categoryKey,
    effectiveSystemId,
    effectiveBronzeMode,
    structure: buildAdminCategoryStructure(draw, eligibleMap, effectiveBronzeMode),
    participants: draw.participants.map((p) => {
      const e = eligibleMap.get(p.entryId)
      return {
        entryId: p.entryId,
        seedPosition: p.seedPosition,
        seedLocked: p.seedLocked,
        displayName: e?.displayName ?? p.snapshotDisplayName ?? '',
        clubName: e?.clubName ?? p.snapshotClubName ?? '',
      }
    }),
  }
}

export async function getBracketPageSettings() {
  const settings = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  return (
    settings ?? {
      id: 'default',
      publicEnabled: false,
      includePaid: true,
      includeUnpaid: false,
      updatedAt: new Date(),
    }
  )
}

export async function getBracketFormatRules() {
  await ensureDefaultFormatRules()
  return prisma.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
}

async function ensureDefaultFormatRules() {
  const ruleCount = await prisma.bracketFormatRule.count()
  if (ruleCount === 0) {
    await prisma.bracketFormatRule.createMany({ data: DEFAULT_FORMAT_RULES })
    return
  }

  const singletonRule = await prisma.bracketFormatRule.findFirst({
    where: {
      enabled: true,
      minParticipants: { lte: 1 },
      maxParticipants: { gte: 1 },
    },
  })
  if (!singletonRule) {
    await prisma.bracketFormatRule.create({
      data: CHAMPION_SINGLETON_FORMAT_RULE,
    })
  }
}

export async function getAdminBracketsDashboard() {
  await ensureDraftExists()
  const settings = await getBracketPageSettings()
  const rules = await getBracketFormatRules()

  const working = await resolveWorkingDraftGeneration()
  const draft = working
    ? await prisma.bracketGeneration.findUnique({
        where: { id: working.id },
        include: {
          categories: {
            include: { participants: { orderBy: { seedPosition: 'asc' } } },
            orderBy: { title: 'asc' },
          },
        },
      })
    : null

  const publicGeneration = await resolvePublicGeneration()
  const published = publicGeneration

  const regState = await prisma.tournamentRegistrationState.findUnique({
    where: { id: 'default' },
  })
  const currentRevision = regState?.revision ?? BigInt(0)

  const eligible = await loadEligibleEntries({
    includePaid: settings.includePaid,
    includeUnpaid: settings.includeUnpaid,
  })
  const eligibleMap = new Map(eligible.map((e) => [e.entryId, e]))
  const placements = await prisma.bracketEntryPlacement.findMany()
  const placementMap = new Map(
    placements.map((p) => [p.entryId, { categoryKey: p.categoryKey, isManualMove: p.isManualMove }]),
  )

  const diff = draft
    ? computeDraftDiff(
        eligible,
        draft.sourceRevision,
        draft.sourceFingerprint,
        currentRevision,
        draft.categories.map((c) => ({
          categoryKey: c.categoryKey,
          sourceFingerprint: c.sourceFingerprint,
          seedingFingerprint: c.seedingFingerprint,
          drawInputFingerprint: c.drawInputFingerprint,
          drawPolicyId: c.drawPolicyId,
          drawPolicyVersion: c.drawPolicyVersion,
          autoSystemId: c.autoSystemId,
          systemOverride: c.systemOverride,
          systemVersion: c.systemVersion,
          participants: c.participants.map((p) => {
            const e = eligibleMap.get(p.entryId)
            return {
              entryId: p.entryId,
              displayName: e?.displayName ?? p.snapshotDisplayName ?? '',
              seedPosition: p.seedPosition,
              clubIdentity: e?.clubIdentity ?? '',
              strengthTier: e?.strengthTier ?? null,
              clubKey: e?.clubKey ?? null,
              cityKey: e?.cityKey ?? null,
              seedLocked: p.seedLocked,
            }
          }),
        })),
        placementMap,
      )
    : {
        globalCompositionStale: true,
        registrationDataStale: true,
        eligibilityCriteriaStale: false,
        categories: {},
      }

  const participantCountByKey = new Map<string, number>()
  for (const draw of draft?.categories ?? []) {
    participantCountByKey.set(draw.categoryKey, draw.participants.length)
  }

  const allCategoryKeys = [
    ...new Set([
      ...eligible.map((e) => e.effectiveCategoryKey),
      ...eligible.map((e) => e.sourceCategoryKey),
      ...(draft?.categories.map((c) => c.categoryKey) ?? []),
    ]),
  ]
    .map((key) => ({
      key,
      title: getCategoryTitleFromKey(key),
      participantCount:
        participantCountByKey.get(key) ??
        eligible.filter((entry) => entry.effectiveCategoryKey === key).length,
    }))
    .sort((a, b) => compareBracketCategoryKeys(a.key, b.key))

  const publicationStateMap = await loadPublicationStateMap()
  const controlsEnabled = Boolean(
    publicGeneration &&
      (await prisma.bracketCategoryDraw.count({
        where: { generationId: publicGeneration.id, status: 'ACTIVE' },
      })) > 0,
  )
  const boutsSettings = await getBoutsPageSettings()
  const autoSyncFailures = draft
    ? await getUnresolvedAutoSyncFailures(draft.id)
    : []

  const draftCategories = (draft?.categories ?? []).filter((c) => c.participants.length > 0)
  const stageEligibility = await (
    await import('./admin/competitionStageDashboard')
  ).loadCategoryStageEligibility(draftCategories)
  const configuredCategoryStages = (
    await import('./admin/competitionStageDashboard')
  ).getConfiguredCategoryStagesFromDraws(draftCategories)

  const categories = draftCategories
    .map((c) => ({
      ...mapAdminCategoryMetadata(
        c,
        eligibleMap,
        placementMap,
        diff,
        rules,
        publicationStateForCategory(c.categoryKey, publicationStateMap, controlsEnabled),
        { boutsMatCount: boutsSettings.matCount },
      ),
      competitionStageEligibility: stageEligibility?.[c.categoryKey],
    }))
    .sort((a, b) => compareBracketCategoryKeys(a.categoryKey, b.categoryKey))

  return {
    settings,
    rules,
    draft: draft ? { id: draft.id, version: draft.version } : null,
    published: published
      ? { id: published.id, publishedAt: published.publishedAt }
      : null,
    controlsEnabled,
    features: {
      independentBoutsRelease: isIndependentBoutsReleaseEnabled(),
    },
    autoSyncFailures,
    registrationRevision: currentRevision.toString(),
    diff,
    categories,
    allCategoryKeys,
    configuredCategoryStages,
  }
}

export async function updateBracketSettings(input: {
  publicEnabled?: boolean
  includePaid?: boolean
  includeUnpaid?: boolean
  draftId?: string
  expectedVersion?: number
  impactToken?: string
}) {
  const current = await getBracketPageSettings()
  const eligibilityChanged =
    input.includePaid !== undefined || input.includeUnpaid !== undefined

  if (eligibilityChanged) {
    if (input.expectedVersion === undefined) {
      throw new BracketOperationError(
        'INVALID_BODY',
        'Для изменения критериев состава укажите версию поколения',
      )
    }
    const nextIncludePaid = input.includePaid ?? current.includePaid
    const nextIncludeUnpaid = input.includeUnpaid ?? current.includeUnpaid

    const { commitSettingsEligibility } = await import('./live/commitSettingsEligibility')
    const txResult = await commitSettingsEligibility({
      includePaid: nextIncludePaid,
      includeUnpaid: nextIncludeUnpaid,
      expectedVersion: input.expectedVersion,
      impactToken: input.impactToken,
    })

    const { computeDiffForDraft } = await import('./dashboardDiff')
    const diff = await computeDiffForDraft(txResult.generation.id)
    return {
      ok: true,
      draft: txResult.generation,
      settingsStale: true,
      diff,
    }
  }

  await prisma.bracketPageSetting.upsert({
    where: { id: 'default' },
    create: {
      publicEnabled: input.publicEnabled ?? current.publicEnabled,
      includePaid: current.includePaid,
      includeUnpaid: current.includeUnpaid,
    },
    update: {
      ...(input.publicEnabled !== undefined ? { publicEnabled: input.publicEnabled } : {}),
    },
  })

  return { ok: true, settingsStale: false }
}

export async function updateBracketFormatRules(input: {
  rules: Array<{
    id?: string
    minParticipants: number
    maxParticipants: number
    systemId: string
    defaultBronzeMode: OlympicBronzeMode | null
    allowedSystemIds: string[]
    sortOrder: number
    enabled: boolean
  }>
  draftId: string
  expectedVersion: number
}) {
  const issues = validateEntireRuleSet(input.rules)
  if (issues.length > 0) {
    return { ok: false, errors: issues }
  }

  const txResult = await prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, { scope: 'minimal' })
    if (ctx.generation.id !== input.draftId || ctx.generation.version !== input.expectedVersion) {
      throw new VersionConflictError()
    }
    const draft = ctx.generation

    const { randomUUID } = await import('crypto')
    await tx.bracketFormatRule.deleteMany()
    for (const rule of input.rules) {
      await tx.bracketFormatRule.create({
        data: {
          id: rule.id || randomUUID(),
          minParticipants: rule.minParticipants,
          maxParticipants: rule.maxParticipants,
          systemId: rule.systemId,
          defaultBronzeMode: rule.defaultBronzeMode,
          allowedSystemIds: rule.allowedSystemIds,
          sortOrder: rule.sortOrder,
          enabled: rule.enabled,
        },
      })
    }

    const draws = await tx.bracketCategoryDraw.findMany({
      where: { generationId: draft.id },
      include: { participants: true },
    })

    const warnings: Array<{ code: string; categoryKey?: string; n?: number }> = []
    const { recalculateDrawFormat } = await import('./core/recalculate')

    for (const draw of draws) {
      const result = recalculateDrawFormat(
        {
          id: draw.id,
          categoryKey: draw.categoryKey,
          status: draw.status,
          statusReason: draw.statusReason,
          autoSystemId: draw.autoSystemId,
          systemOverride: draw.systemOverride,
          autoBronzeMode: draw.autoBronzeMode,
          bronzeModeOverride: draw.bronzeModeOverride,
          participantCount: draw.participants.length,
        },
        input.rules,
      )
      warnings.push(...result.warnings)
      await tx.bracketCategoryDraw.update({
        where: { id: draw.id },
        data: {
          status: result.status as 'ACTIVE' | 'INACTIVE' | 'UNSUPPORTED',
          statusReason: result.statusReason as 'NO_FORMAT_RULE' | 'EXCEEDS_MAX_PARTICIPANTS' | 'SYSTEM_UNAVAILABLE' | null,
          autoSystemId: result.autoSystemId,
          systemOverride: result.systemOverride,
          autoBronzeMode: result.autoBronzeMode,
          bronzeModeOverride: result.bronzeModeOverride,
          systemVersion: null,
        },
      })
    }

    await tx.bracketGeneration.update({
      where: { id: draft.id },
      data: { version: draft.version + 1 },
    })

    return {
      ok: true,
      draft: { id: draft.id, version: draft.version + 1 },
      warnings,
    }
  })

  const { computeDiffForDraft } = await import('./dashboardDiff')
  const diff = await computeDiffForDraft(txResult.draft.id)
  return { ...txResult, diff }
}

export async function updateBracketDraw(input: {
  drawId: string
  draftId: string
  expectedVersion: number
  systemOverride?: string | null
  bronzeModeOverride?: OlympicBronzeMode | null
  participants?: Array<{ entryId: string; seedPosition: number; seedLocked?: boolean }>
}) {
  const txResult = await prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, { scope: 'minimal' })
    if (ctx.generation.id !== input.draftId || ctx.generation.version !== input.expectedVersion) {
      throw new VersionConflictError()
    }
    const draft = ctx.generation
    const draw = await tx.bracketCategoryDraw.findUnique({ where: { id: input.drawId } })
    if (!draw || draw.generationId !== draft.id) {
      throw new DraftConflictError()
    }

    if (input.systemOverride !== undefined || input.bronzeModeOverride !== undefined) {
      const participants = await tx.bracketDrawParticipant.findMany({ where: { drawId: draw.id } })
      const rules = await tx.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
      const { recalculateDrawFormat } = await import('./core/recalculate')
      const nextOverride =
        input.systemOverride !== undefined ? input.systemOverride : draw.systemOverride
      const nextBronze =
        input.bronzeModeOverride !== undefined
          ? input.bronzeModeOverride
          : draw.bronzeModeOverride
      const result = recalculateDrawFormat(
        {
          id: draw.id,
          categoryKey: draw.categoryKey,
          status: draw.status,
          statusReason: draw.statusReason,
          autoSystemId: draw.autoSystemId,
          systemOverride: nextOverride,
          autoBronzeMode: draw.autoBronzeMode,
          bronzeModeOverride: nextBronze,
          participantCount: participants.length,
        },
        rules,
      )
      await tx.bracketCategoryDraw.update({
        where: { id: draw.id },
        data: {
          status: result.status as 'ACTIVE' | 'INACTIVE' | 'UNSUPPORTED',
          statusReason: result.statusReason as
            | 'NO_FORMAT_RULE'
            | 'EXCEEDS_MAX_PARTICIPANTS'
            | 'SYSTEM_UNAVAILABLE'
            | null,
          autoSystemId: result.autoSystemId,
          systemOverride: result.systemOverride,
          autoBronzeMode: result.autoBronzeMode,
          bronzeModeOverride: result.bronzeModeOverride,
          systemVersion: null,
        },
      })
    }

    let balanceDelta = null
    let drawBalanceReport = null
    const categoryKey = draw.categoryKey

    if (input.participants) {
      const settingsBefore = await tx.bracketPageSetting.findUnique({ where: { id: 'default' } })
      const eligibleBefore = await loadEligibleEntries({
        includePaid: settingsBefore?.includePaid !== false,
        includeUnpaid: Boolean(settingsBefore?.includeUnpaid),
      })
      const eligibleMapBefore = new Map(eligibleBefore.map((entry) => [entry.entryId, entry]))
      const beforeParticipants = await tx.bracketDrawParticipant.findMany({
        where: { drawId: draw.id },
        orderBy: { seedPosition: 'asc' },
      })
      const beforeReport = buildDrawBalanceReportFromParticipants(
        beforeParticipants.map((participant) =>
          toBracketParticipantInput(participant, eligibleMapBefore.get(participant.entryId), {
            displayName: participant.snapshotDisplayName,
            clubName: participant.snapshotClubName,
            city: participant.snapshotCity,
            publicNumber: participant.snapshotPublicNumber,
          }),
        ),
      )

      const existingParticipants = await tx.bracketDrawParticipant.findMany({
        where: { drawId: draw.id },
      })
      const seedValidation = validateParticipantSeedUpdatesWithLocks(
        input.participants,
        existingParticipants.map((participant) => ({
          entryId: participant.entryId,
          seedPosition: participant.seedPosition,
          seedLocked: participant.seedLocked,
        })),
      )
      if (seedValidation) {
        throw new BracketOperationError(seedValidation.code, seedValidation.message)
      }

      for (let i = 0; i < input.participants.length; i++) {
        const p = input.participants[i]
        await tx.bracketDrawParticipant.updateMany({
          where: { drawId: draw.id, entryId: p.entryId },
          data: {
            seedPosition: -(i + 1),
          },
        })
      }
      for (const p of input.participants) {
        await tx.bracketDrawParticipant.updateMany({
          where: { drawId: draw.id, entryId: p.entryId },
          data: {
            seedPosition: p.seedPosition,
            ...(p.seedLocked !== undefined ? { seedLocked: p.seedLocked } : {}),
          },
        })
      }

      const settings = await tx.bracketPageSetting.findUnique({ where: { id: 'default' } })
      const eligible = await loadEligibleEntries({
        includePaid: settings?.includePaid !== false,
        includeUnpaid: Boolean(settings?.includeUnpaid),
      })
      const eligibleMap = new Map(eligible.map((entry) => [entry.entryId, entry]))
      const updatedParticipants = await tx.bracketDrawParticipant.findMany({
        where: { drawId: draw.id },
        orderBy: { seedPosition: 'asc' },
      })
      const participantInputs = updatedParticipants.map((participant) =>
        toBracketParticipantInput(participant, eligibleMap.get(participant.entryId), {
          displayName: participant.snapshotDisplayName,
          clubName: participant.snapshotClubName,
          city: participant.snapshotCity,
          publicNumber: participant.snapshotPublicNumber,
        }),
      )
      const refreshedDraw = await tx.bracketCategoryDraw.findUnique({ where: { id: draw.id } })
      if (refreshedDraw) {
        const fingerprints = recomputeDrawFingerprints(refreshedDraw, participantInputs)
        await tx.bracketCategoryDraw.update({
          where: { id: draw.id },
          data: {
            seedingFingerprint: fingerprints.seedingFingerprint,
            drawInputFingerprint: fingerprints.drawInputFingerprint,
            drawPolicyId: fingerprints.drawPolicyId,
            drawPolicyVersion: fingerprints.drawPolicyVersion,
          },
        })
      }

      await recomputeDrawStructure(tx, draw.id)

      drawBalanceReport = buildDrawBalanceReportFromParticipants(participantInputs)
      balanceDelta = computeBalanceDelta(beforeReport, drawBalanceReport)
    }

    await tx.bracketGeneration.update({
      where: { id: draft.id },
      data: { version: draft.version + 1 },
    })

    return {
      ok: true,
      draft: { id: draft.id, version: draft.version + 1 },
      drawBalanceReport,
      balanceDelta,
      categoryKey,
    }
  })

  const { computeDiffForDraft } = await import('./dashboardDiff')
  const diff = await computeDiffForDraft(txResult.draft.id)
  const { buildCategoryCanonicalDto } = await import('./admin/categoryCanonical')
  const category = await buildCategoryCanonicalDto(txResult.draft.id, txResult.categoryKey!)
  return { ...txResult, diff, category }
}

export async function getPublicBrackets() {
  const settings = await getBracketPageSettings()
  if (!settings.publicEnabled) {
    return null
  }

  const published = await getActivePublishedGeneration()

  if (!published) {
    return { published: false, publishedAt: null, categories: [] }
  }

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  await prisma.$transaction(async (tx) => {
    for (const pair of visiblePairs) {
      await maybeLazyReconcileCategoryPublishedStructure(tx, pair.draw.categoryKey)
    }
  }, LAZY_RECONCILE_TX_OPTIONS)
  const refreshedPairs = await getPublicVisiblePublishedDraws(published)
  const visibleDraws = refreshedPairs.map((pair) => pair.draw)

  const allBoutIds = visibleDraws.flatMap((draw) => {
    const effectiveBronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
    const structure = readPublishedStructure({
      publishedStructureJson: draw.publishedStructureJson,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
      systemVersion: draw.systemVersion,
      autoBronzeMode: draw.autoBronzeMode,
      bronzeModeOverride: draw.bronzeModeOverride,
      drawSeed: draw.drawSeed,
      participants: draw.participants,
      effectiveBronzeMode,
    })
    if (!structure) return []
    return collectCategoryBoutIds(structure, {
      categoryKey: draw.categoryKey,
      categoryTitle: getCategoryTitleFromKey(draw.categoryKey),
      discipline: draw.discipline,
      storedMatIndex: draw.matIndex,
      competitionStage: draw.competitionStage,
    })
  })

  const activeResults =
    allBoutIds.length > 0 ? await listActiveBoutResultsForBoutIds(prisma, allBoutIds) : []
  const resultsByBoutId = new Map(activeResults.map((result) => [result.boutId, result]))

  const categories = visibleDraws.map((c) => {
    const effectiveSystemId = getEffectiveSystemId(c.autoSystemId, c.systemOverride)
    const effectiveBronzeMode = getEffectiveBronzeMode(c.autoBronzeMode, c.bronzeModeOverride)
    const system =
      effectiveSystemId && c.systemVersion != null
        ? getSystemForDraw(c.autoSystemId, c.systemOverride, c.systemVersion, true)
        : null

    const participants = c.participants.map((p) => ({
      entryId: p.entryId,
      seedPosition: p.seedPosition,
      displayName: p.snapshotDisplayName ?? '',
      clubName: p.snapshotClubName ?? '',
      city: p.snapshotCity ?? '',
      publicNumber: p.snapshotPublicNumber,
    }))

    const structure = readPublishedStructure({
      publishedStructureJson: c.publishedStructureJson,
      autoSystemId: c.autoSystemId,
      systemOverride: c.systemOverride,
      systemVersion: c.systemVersion,
      autoBronzeMode: c.autoBronzeMode,
      bronzeModeOverride: c.bronzeModeOverride,
      drawSeed: c.drawSeed,
      participants: c.participants,
      effectiveBronzeMode,
    })

    const categoryMeta = {
      categoryKey: c.categoryKey,
      categoryTitle: getCategoryTitleFromKey(c.categoryKey),
      discipline: c.discipline,
      storedMatIndex: c.matIndex,
      competitionStage: c.competitionStage,
    }

    const categoryBoutIds = structure ? collectCategoryBoutIds(structure, categoryMeta) : []
    const categoryResults = categoryBoutIds
      .map((boutId) => resultsByBoutId.get(boutId))
      .filter((result): result is NonNullable<typeof result> => result != null)

    return {
      categoryKey: c.categoryKey,
      discipline: c.discipline,
      title: getCategoryTitleFromKey(c.categoryKey),
      systemId: effectiveSystemId,
      systemVersion: c.systemVersion,
      bronzeMode: effectiveBronzeMode,
      participants,
      structure,
      result: readCategoryResult(structure, effectiveSystemId, {
        participantCount: participants.length,
        bronzeMode: effectiveBronzeMode,
      }),
      boutOutcomes: structure ? buildBoutOutcomesMap(categoryResults) : {},
    }
  })

  const { sortBracketCategories } = await import('./publicCategoryFilters')

  return {
    published: true,
    publishedAt: published.publishedAt,
    categories: sortBracketCategories(categories),
  }
}

export async function getPublicResults() {
  const settings = await getBracketPageSettings()
  if (!settings.publicEnabled) {
    return null
  }

  const published = await getActivePublishedGeneration()
  if (!published) {
    return {
      published: false,
      publishedAt: null,
      rows: [],
      filterCategories: [],
      stats: { medalists: 0, categoriesWithResults: 0 },
    }
  }

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  await prisma.$transaction(async (tx) => {
    for (const pair of visiblePairs) {
      await maybeLazyReconcileCategoryPublishedStructure(tx, pair.draw.categoryKey)
    }
  }, LAZY_RECONCILE_TX_OPTIONS)
  const refreshedPairs = await getPublicVisiblePublishedDraws(published)
  const visibleDraws = refreshedPairs.map((pair) => pair.draw)

  const filterSources: PublicResultFilterCategorySource[] = visibleDraws.map((draw) => ({
    categoryKey: draw.categoryKey,
    discipline: draw.discipline,
    title: getCategoryTitleFromKey(draw.categoryKey),
    participants: draw.participants.map((participant) => ({
      displayName: participant.snapshotDisplayName ?? '',
      clubName: participant.snapshotClubName ?? '',
      city: participant.snapshotCity ?? '',
    })),
  }))

  const filterCategories = buildFilterCategories(filterSources)

  const categorySources: PublicResultCategorySource[] = visibleDraws.map((draw) => {
    const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const effectiveBronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)

    const participants = draw.participants.map((participant) => ({
      entryId: participant.entryId,
      displayName: participant.snapshotDisplayName ?? '',
      clubName: participant.snapshotClubName ?? '',
      city: participant.snapshotCity ?? '',
    }))

    const structure = readPublishedStructure({
      publishedStructureJson: draw.publishedStructureJson,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
      systemVersion: draw.systemVersion,
      autoBronzeMode: draw.autoBronzeMode,
      bronzeModeOverride: draw.bronzeModeOverride,
      drawSeed: draw.drawSeed,
      participants: draw.participants,
      effectiveBronzeMode,
    })

    return {
      categoryKey: draw.categoryKey,
      discipline: draw.discipline,
      title: getCategoryTitleFromKey(draw.categoryKey),
      participants,
      result: readCategoryResult(structure, effectiveSystemId, {
        participantCount: participants.length,
        bronzeMode: effectiveBronzeMode,
      }),
    }
  })

  const rows = buildPublicResultRows(categorySources)

  return {
    published: true,
    publishedAt: published.publishedAt,
    rows,
    filterCategories,
    stats: buildPublicResultsStats(rows),
  }
}

export { setCategoriesPublicVisibility } from './generation/categoryVisibility'
export { setCategoriesBoutsReleased }

export { listBracketMoveAudit, undoBracketMoveAudit } from './placements/undo'

export {
  syncBracketDraft,
  redrawBracketDraft,
  publishBracketDraft,
  moveBracketEntry,
  resetBracketEntryPlacement,
  DraftConflictError,
  VersionConflictError,
}
