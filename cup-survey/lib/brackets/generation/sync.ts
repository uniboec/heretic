import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { loadEligibleEntries } from '../core/eligibility'
import {
  computeCategoryCompositionFingerprint,
  computeSourceCompositionFingerprint,
} from '../core/fingerprint'
import { compactSeedPositions } from '../core/seeding/validateSeeds'
import { assertCategorySyncAllowed } from '../core/syncGuards'
import { DraftConflictError, BracketOperationError, VersionConflictError } from '../core/errors'
import { acquireBracketWriteLocks } from '../live/locks'
import { rebuildDrawAfterCompositionChange } from './rebuildDraw'
import { computeCategoryDrawSeed } from './ensureDraft'
import { recordAutoSyncSuccess } from './autoSyncEvents'
import { getCategoryTitleFromKey } from '../../registration/categoryIdentity'
import {
  mergeAdminOwnedDrawConfiguration,
  type AdminOwnedDrawConfiguration,
} from './mergeAdminOwnedDrawConfiguration'
import { getActivePublishedGeneration, getActivePublishedDrawByCategoryKey } from './publishedDraws'
import { ensureLivePublicationPointers } from './publicationState'
import { BRACKET_MUTATION_TX_OPTIONS } from '../core/transactionOptions'

async function loadFormatRules() {
  return prisma.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
}

async function loadSettings() {
  const s = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  return s ?? { includePaid: true, includeUnpaid: false }
}

export async function syncBracketDraft(input: {
  draftId: string
  expectedVersion: number
  scope: 'all' | 'category'
  categoryKey?: string
  /** Синхронизация только указанных категорий (после изменения заявки). */
  categoryKeys?: string[]
  /** Пропустить требование «обновить весь состав» и зафиксировать revision. */
  afterRegistrationChange?: boolean
  operationId?: string
}) {
  const settings = await loadSettings()
  const rules = await loadFormatRules()

  const lockCategoryKeys = input.categoryKeys?.length
    ? input.categoryKeys
    : input.scope === 'category' && input.categoryKey
      ? [input.categoryKey]
      : undefined

  const result = await prisma.$transaction(async (tx) => {
    const { generation: draft, registrationState: regState } = await acquireBracketWriteLocks(tx, {
      scope: 'minimal',
      categoryKeys: lockCategoryKeys,
    })
    if (draft.id !== input.draftId) {
      throw new DraftConflictError()
    }
    if (draft.version !== input.expectedVersion) {
      throw new VersionConflictError()
    }

    if (!input.afterRegistrationChange) {
      assertCategorySyncAllowed(input.scope, draft.sourceRevision, regState.revision)
    }

    const resetComposition = input.scope === 'all' && !input.afterRegistrationChange
    if (resetComposition) {
      await tx.bracketEntryPlacement.deleteMany()
      await tx.bracketCategoryDraw.updateMany({
        where: { generationId: draft.id },
        data: { systemOverride: null, bronzeModeOverride: null },
      })
    }

    const existingDraws = await tx.bracketCategoryDraw.findMany({
      where: { generationId: draft.id },
      include: { participants: true },
    })
    const drawByKey = new Map(existingDraws.map((d) => [d.categoryKey, d]))
    const activePublished = await getActivePublishedGeneration(tx)

    const eligible = await loadEligibleEntries(
      {
        includePaid: settings.includePaid,
        includeUnpaid: settings.includeUnpaid,
      },
      resetComposition ? { useSourceCategoryOnly: true, tx } : { tx },
    )

    if (resetComposition) {
      const hadParticipants = existingDraws.some((draw) => draw.participants.length > 0)
      if (eligible.length === 0 && hadParticipants) {
        throw new BracketOperationError(
          'NO_ELIGIBLE_ENTRIES',
          'Ни один спортсмен не подходит под текущие критерии допуска. Проверьте настройки «Включать оплаченных / неоплаченных» или статусы оплаты в заявках.',
        )
      }
    }

    const byCategory = new Map<string, typeof eligible>()
    for (const e of eligible) {
      const list = byCategory.get(e.effectiveCategoryKey) ?? []
      list.push(e)
      byCategory.set(e.effectiveCategoryKey, list)
    }

    const targetKeys = input.categoryKeys?.length
      ? [...new Set(input.categoryKeys)]
      : input.scope === 'category' && input.categoryKey
        ? [input.categoryKey]
        : [...byCategory.keys(), ...existingDraws.map((d) => d.categoryKey)]

    const uniqueKeys = [...new Set(targetKeys)]
    const warnings: Array<{ code: string; categoryKey?: string; n?: number }> = []

    for (const categoryKey of uniqueKeys) {
      const entries = byCategory.get(categoryKey) ?? []
      const existing = drawByKey.get(categoryKey)

      if (entries.length === 0) {
        if (existing) {
          await tx.bracketPublicationState.deleteMany({ where: { categoryKey } })
          await tx.bracketCategoryDraw.delete({ where: { id: existing.id } })
          drawByKey.delete(categoryKey)
        }
        continue
      }

      const discipline = entries[0]?.sourceCategoryKey.split(':')[0] ?? existing?.discipline ?? categoryKey.split(':')[0]
      const title = existing?.title ?? getCategoryTitleFromKey(categoryKey)

      let drawId = existing?.id
      if (!existing) {
        const created = await tx.bracketCategoryDraw.create({
          data: {
            generationId: draft.id,
            categoryKey,
            discipline,
            title,
            drawSeed: computeCategoryDrawSeed(draft.baseSeed, categoryKey, 0),
            redrawRevision: 0,
          },
        })
        drawId = created.id
      }

      if (!drawId) continue

      const existingParticipants = existing?.participants ?? []
      const orderMap = new Map(
        existingParticipants.map((p) => [p.entryId, { seedPosition: p.seedPosition, seedLocked: p.seedLocked }]),
      )

      const entryIds = new Set(entries.map((e) => e.entryId))
      for (const p of existingParticipants) {
        if (!entryIds.has(p.entryId)) {
          await tx.bracketDrawParticipant.delete({ where: { id: p.id } })
        }
      }

      let pos = 1
      const usedPositions = new Set<number>()
      const seedAssignments: Array<{
        entryId: string
        seedPosition: number
        seedLocked: boolean
      }> = []

      for (const e of entries) {
        const prev = orderMap.get(e.entryId)
        let seedPosition = prev?.seedPosition ?? pos
        while (usedPositions.has(seedPosition)) seedPosition++
        usedPositions.add(seedPosition)
        pos = Math.max(pos, seedPosition + 1)

        seedAssignments.push({
          entryId: e.entryId,
          seedPosition,
          seedLocked: prev?.seedLocked ?? false,
        })
      }

      const compactedAssignments = compactSeedPositions(seedAssignments)
      const tempSeedBase = 100_000
      for (let index = 0; index < compactedAssignments.length; index++) {
        const assignment = compactedAssignments[index]
        await tx.bracketDrawParticipant.upsert({
          where: { drawId_entryId: { drawId, entryId: assignment.entryId } },
          create: {
            drawId,
            entryId: assignment.entryId,
            seedPosition: tempSeedBase + index,
            seedLocked: assignment.seedLocked,
          },
          update: {
            seedPosition: tempSeedBase + index,
            seedLocked: assignment.seedLocked,
          },
        })
      }
      for (const assignment of compactedAssignments) {
        await tx.bracketDrawParticipant.update({
          where: { drawId_entryId: { drawId, entryId: assignment.entryId } },
          data: {
            seedPosition: assignment.seedPosition,
            seedLocked: assignment.seedLocked,
          },
        })
      }

      const categoryFingerprint = computeCategoryCompositionFingerprint(
        entries.map((e) => ({
          entryId: e.entryId,
          effectiveCategoryKey: e.effectiveCategoryKey,
        })),
      )
      await tx.bracketCategoryDraw.update({
        where: { id: drawId },
        data: {
          sourceFingerprint: categoryFingerprint,
          title: getCategoryTitleFromKey(categoryKey),
        },
      })

      const w = await rebuildDrawAfterCompositionChange(tx, drawId, rules, entries.length)
      warnings.push(...w)

      const updatedDraw = await tx.bracketCategoryDraw.findUnique({ where: { id: drawId } })
      if (updatedDraw) {
        const activePublishedDraw =
          activePublished != null
            ? (await getActivePublishedDrawByCategoryKey(activePublished, categoryKey, tx))?.draw ??
              null
            : null
        const candidate: AdminOwnedDrawConfiguration = {
          systemOverride: updatedDraw.systemOverride,
          bronzeModeOverride: updatedDraw.bronzeModeOverride,
          drawPolicyId: updatedDraw.drawPolicyId,
          drawPolicyVersion: updatedDraw.drawPolicyVersion,
          matIndex: updatedDraw.matIndex,
          competitionStage: updatedDraw.competitionStage,
        }
        const merged = mergeAdminOwnedDrawConfiguration({
          candidate,
          currentDraftDraw: existing ?? updatedDraw,
          activePublishedDraw,
        })
        await tx.bracketCategoryDraw.update({
          where: { id: drawId },
          data: {
            systemOverride: merged.systemOverride,
            bronzeModeOverride: merged.bronzeModeOverride,
            drawPolicyId: merged.drawPolicyId,
            drawPolicyVersion: merged.drawPolicyVersion,
            matIndex: merged.matIndex,
            competitionStage: merged.competitionStage,
          },
        })
      }

      if (input.afterRegistrationChange && input.operationId) {
        await recordAutoSyncSuccess(tx, {
          operationId: input.operationId,
          generationId: draft.id,
          categoryKey,
          revision: regState.revision,
        })
      }
    }

    if (input.scope === 'all' || input.afterRegistrationChange) {
      const sourceFingerprint = computeSourceCompositionFingerprint(eligible)
      await tx.bracketGeneration.update({
        where: { id: draft.id },
        data: {
          sourceRevision: regState.revision,
          sourceFingerprint,
          version: draft.version + 1,
        },
      })
    } else {
      await tx.bracketGeneration.update({
        where: { id: draft.id },
        data: { version: draft.version + 1 },
      })
    }

    await ensureLivePublicationPointers(tx, draft.id)

    const updated = await tx.bracketGeneration.findUnique({ where: { id: draft.id } })
    const draftResult = { id: draft.id, version: updated?.version ?? draft.version + 1 }
    return {
      ok: true,
      draft: draftResult,
      warnings,
    }
  }, BRACKET_MUTATION_TX_OPTIONS)

  const { computeDiffForDraft } = await import('../dashboardDiff')
  const diff = await computeDiffForDraft(result.draft.id)
  let category
  let categories
  if (input.scope === 'category' && input.categoryKey) {
    const { buildCategoryCanonicalDto } = await import('../admin/categoryCanonical')
    category = await buildCategoryCanonicalDto(result.draft.id, input.categoryKey)
  } else if (input.scope === 'all') {
    const { buildCategoriesCanonicalDto } = await import('../admin/categoryCanonical')
    const draws = await prisma.bracketCategoryDraw.findMany({
      where: { generationId: result.draft.id },
      select: { categoryKey: true },
    })
    categories = await buildCategoriesCanonicalDto(
      result.draft.id,
      draws.map((draw) => draw.categoryKey),
    )
  }
  return {
    ...result,
    diff,
    category,
    categories,
    replaceCategories: input.scope === 'all',
  }
}
