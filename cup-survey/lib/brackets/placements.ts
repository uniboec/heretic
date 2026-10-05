import { prisma } from '../prisma'
import { BracketOperationError } from './core/errors'
import { categoryFingerprintForDraw } from './core/fingerprint'
import { acquireBracketWriteLocks } from './live/locks'
import { getCategoryTitleFromKey } from '../registration/categoryIdentity'
import { validateTargetCategoryStructure } from '../registration/categoryRules'
import { loadConsolidationAthleteContexts } from './consolidation/eligibility'
import { deleteCategoryDrawIfEmpty } from './core/cleanupEmptyDraw'
import { rebuildDrawAfterCompositionChange } from './generation/rebuildDraw'
import { computeCategoryDrawSeed } from './generation/ensureDraft'
import { redrawCategoryDrawsInTransaction } from './generation/redraw'
import { ensureLivePublicationPointers } from './generation/publicationState'
import { loadEligibleEntries } from './core/eligibility'
import { BRACKET_MUTATION_TX_OPTIONS } from './core/transactionOptions'

async function loadFormatRules() {
  return prisma.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
}

async function loadSettings() {
  const s = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  return s ?? { includePaid: true, includeUnpaid: false }
}

export async function moveBracketEntry(input: {
  draftId: string
  expectedVersion: number
  entryId: string
  targetCategoryKey: string
  seedPosition?: number
  movedBy?: string
}) {
  const settings = await loadSettings()
  const rules = await loadFormatRules()

  const result = await prisma.$transaction(async (tx) => {
    const fromPlacementRow = await tx.bracketEntryPlacement.findUnique({
      where: { entryId: input.entryId },
    })

    const ctx = await acquireBracketWriteLocks(tx, {
      scope: 'minimal',
      categoryKeys: [fromPlacementRow?.categoryKey, input.targetCategoryKey].filter(
        (key): key is string => Boolean(key),
      ),
    })
    const draft = ctx.generation
    if (draft.id !== input.draftId || draft.version !== input.expectedVersion) {
      throw new BracketOperationError('VERSION_CONFLICT', 'Версия черновика изменилась')
    }

    const eligible = await loadEligibleEntries({
      includePaid: settings.includePaid,
      includeUnpaid: settings.includeUnpaid,
    })
    const eligibleMap = new Map(eligible.map((entry) => [entry.entryId, entry]))
    const entry = eligible.find((e) => e.entryId === input.entryId)
    if (!entry) {
      throw new BracketOperationError(
        'ENTRY_NOT_FOUND',
        'Участник не найден или не подходит по критериям',
      )
    }

    const fromCategoryKeyResolved = fromPlacementRow?.categoryKey ?? entry.sourceCategoryKey

    if (input.targetCategoryKey === fromCategoryKeyResolved) {
      throw new BracketOperationError(
        'SAME_TARGET_CATEGORY',
        'Участник уже находится в выбранной категории',
      )
    }

    const athleteContexts = await loadConsolidationAthleteContexts([input.entryId])
    const athleteContext = athleteContexts.get(input.entryId)
    if (!athleteContext) {
      throw new BracketOperationError('ENTRY_NOT_FOUND', 'Участник не найден')
    }

    const validationError = validateTargetCategoryStructure(
      input.targetCategoryKey,
      athleteContext.gender,
    )
    if (validationError) {
      throw new BracketOperationError(validationError.code, validationError.message)
    }

    let targetDraw = await tx.bracketCategoryDraw.findUnique({
      where: { generationId_categoryKey: { generationId: draft.id, categoryKey: input.targetCategoryKey } },
      include: { participants: true },
    })

    if (!targetDraw) {
      const discipline = input.targetCategoryKey.split(':')[0]
      targetDraw = await tx.bracketCategoryDraw.create({
        data: {
          generationId: draft.id,
          categoryKey: input.targetCategoryKey,
          discipline,
          title: getCategoryTitleFromKey(input.targetCategoryKey),
          drawSeed: computeCategoryDrawSeed(draft.baseSeed, input.targetCategoryKey, 0),
          redrawRevision: 0,
        },
        include: { participants: true },
      })
    }

    const sourceDraw = await tx.bracketCategoryDraw.findFirst({
      where: {
        generationId: draft.id,
        participants: { some: { entryId: input.entryId } },
      },
      include: { participants: true },
    })

    let sourceDrawCategoryKey: string | null = null

    if (sourceDraw && sourceDraw.id !== targetDraw.id) {
      await tx.bracketDrawParticipant.deleteMany({
        where: { drawId: sourceDraw.id, entryId: input.entryId },
      })
      const remaining = sourceDraw.participants.filter((p) => p.entryId !== input.entryId)
      const remainingCount = remaining.length
      const deleted = await deleteCategoryDrawIfEmpty(tx, sourceDraw.id, remainingCount)
      if (!deleted) {
        sourceDrawCategoryKey = sourceDraw.categoryKey
        const fp = categoryFingerprintForDraw(
          sourceDraw.categoryKey,
          remaining.map((p) => p.entryId),
        )
        await tx.bracketCategoryDraw.update({
          where: { id: sourceDraw.id },
          data: { sourceFingerprint: fp },
        })
        await rebuildDrawAfterCompositionChange(tx, sourceDraw.id, rules, remainingCount)
      }
    }

    const usedPositions = new Set(targetDraw.participants.map((p) => p.seedPosition))
    let seedPosition = input.seedPosition ?? 1
    while (usedPositions.has(seedPosition)) seedPosition++

    await tx.bracketDrawParticipant.upsert({
      where: { drawId_entryId: { drawId: targetDraw.id, entryId: input.entryId } },
      create: {
        drawId: targetDraw.id,
        entryId: input.entryId,
        seedPosition,
        seedLocked: false,
      },
      update: { seedPosition },
    })

    await tx.bracketEntryPlacement.upsert({
      where: { entryId: input.entryId },
      create: {
        entryId: input.entryId,
        categoryKey: input.targetCategoryKey,
        isManualMove: true,
        movedAt: new Date(),
      },
      update: {
        categoryKey: input.targetCategoryKey,
        isManualMove: true,
        movedAt: new Date(),
      },
    })

    await tx.bracketMoveAudit.create({
      data: {
        entryId: input.entryId,
        action: 'MOVE',
        fromCategoryKey: fromCategoryKeyResolved,
        toCategoryKey: input.targetCategoryKey,
        movedBy: input.movedBy ?? null,
      },
    })

    const updatedParticipants = await tx.bracketDrawParticipant.findMany({
      where: { drawId: targetDraw.id },
    })
    const fp = categoryFingerprintForDraw(
      targetDraw.categoryKey,
      updatedParticipants.map((p) => p.entryId),
    )
    await tx.bracketCategoryDraw.update({
      where: { id: targetDraw.id },
      data: { sourceFingerprint: fp },
    })
    await rebuildDrawAfterCompositionChange(tx, targetDraw.id, rules, updatedParticipants.length)

    const redrawCategoryKeys = [
      ...(sourceDrawCategoryKey ? [sourceDrawCategoryKey] : []),
      input.targetCategoryKey,
    ]
    await redrawCategoryDrawsInTransaction(tx, {
      baseSeed: draft.baseSeed,
      generationId: draft.id,
      categoryKeys: redrawCategoryKeys,
      eligibleMap,
      resetBoutsReleased: true,
    })

    await ensureLivePublicationPointers(tx, draft.id)

    await tx.bracketGeneration.update({
      where: { id: draft.id },
      data: { version: draft.version + 1 },
    })

    const draftResult = { id: draft.id, version: draft.version + 1 }
    const affectedCategoryKeys = [...new Set([fromCategoryKeyResolved, input.targetCategoryKey])]
    return {
      ok: true,
      draft: draftResult,
      warnings: [],
      affectedCategoryKeys,
    }
  }, BRACKET_MUTATION_TX_OPTIONS)

  const { computeDiffForDraft } = await import('./dashboardDiff')
  const { buildCategoriesCanonicalDto } = await import('./admin/categoryCanonical')
  const diff = await computeDiffForDraft(result.draft.id)
  const categories = await buildCategoriesCanonicalDto(
    result.draft.id,
    result.affectedCategoryKeys ?? [],
  )
  return { ...result, diff, categories }
}

export async function resetBracketEntryPlacement(input: {
  draftId: string
  expectedVersion: number
  entryId: string
  movedBy?: string
}) {
  const settings = await loadSettings()
  const rules = await loadFormatRules()

  const result = await prisma.$transaction(async (tx) => {
    const placement = await tx.bracketEntryPlacement.findUnique({
      where: { entryId: input.entryId },
    })

    const ctx = await acquireBracketWriteLocks(tx, {
      scope: 'minimal',
      categoryKeys: [placement?.categoryKey, placement?.categoryKey].filter(
        (key): key is string => Boolean(key),
      ),
    })
    const draft = ctx.generation
    if (draft.id !== input.draftId || draft.version !== input.expectedVersion) {
      throw new BracketOperationError('VERSION_CONFLICT', 'Версия черновика изменилась')
    }

    const eligible = await loadEligibleEntries({
      includePaid: settings.includePaid,
      includeUnpaid: settings.includeUnpaid,
    })
    const eligibleMap = new Map(eligible.map((entry) => [entry.entryId, entry]))
    const entry = eligible.find((e) => e.entryId === input.entryId)
    if (!entry) {
      throw new BracketOperationError('ENTRY_NOT_FOUND', 'Участник не найден')
    }

    const placementRow = await tx.bracketEntryPlacement.findUnique({
      where: { entryId: input.entryId },
    })
    if (!placementRow) {
      return { ok: true, draft: { id: draft.id, version: draft.version }, warnings: [] }
    }

    const currentDraw = await tx.bracketCategoryDraw.findFirst({
      where: {
        generationId: draft.id,
        participants: { some: { entryId: input.entryId } },
      },
      include: { participants: true },
    })

    let previousDrawCategoryKey: string | null = null

    if (currentDraw && currentDraw.categoryKey !== entry.sourceCategoryKey) {
      await tx.bracketDrawParticipant.deleteMany({
        where: { drawId: currentDraw.id, entryId: input.entryId },
      })
      const remaining = currentDraw.participants.filter((p) => p.entryId !== input.entryId)
      const remainingCount = remaining.length
      const deleted = await deleteCategoryDrawIfEmpty(tx, currentDraw.id, remainingCount)
      if (!deleted) {
        previousDrawCategoryKey = currentDraw.categoryKey
        const fp = categoryFingerprintForDraw(
          currentDraw.categoryKey,
          remaining.map((p) => p.entryId),
        )
        await tx.bracketCategoryDraw.update({
          where: { id: currentDraw.id },
          data: { sourceFingerprint: fp },
        })
        await rebuildDrawAfterCompositionChange(tx, currentDraw.id, rules, remainingCount)
      }
    }

    await tx.bracketEntryPlacement.delete({ where: { entryId: input.entryId } })

    const sourceCategoryKey = entry.sourceCategoryKey
    let sourceDraw = await tx.bracketCategoryDraw.findUnique({
      where: {
        generationId_categoryKey: { generationId: draft.id, categoryKey: sourceCategoryKey },
      },
      include: { participants: true },
    })

    if (!sourceDraw) {
      const discipline = sourceCategoryKey.split(':')[0]
      sourceDraw = await tx.bracketCategoryDraw.create({
        data: {
          generationId: draft.id,
          categoryKey: sourceCategoryKey,
          discipline,
          title: getCategoryTitleFromKey(sourceCategoryKey),
          drawSeed: computeCategoryDrawSeed(draft.baseSeed, sourceCategoryKey, 0),
          redrawRevision: 0,
        },
        include: { participants: true },
      })
    }

    const alreadyInSource = sourceDraw.participants.some((p) => p.entryId === input.entryId)
    if (!alreadyInSource) {
      const usedPositions = new Set(sourceDraw.participants.map((p) => p.seedPosition))
      let seedPosition = 1
      while (usedPositions.has(seedPosition)) seedPosition++

      await tx.bracketDrawParticipant.create({
        data: {
          drawId: sourceDraw.id,
          entryId: input.entryId,
          seedPosition,
          seedLocked: false,
        },
      })
    }

    const sourceParticipants = await tx.bracketDrawParticipant.findMany({
      where: { drawId: sourceDraw.id },
    })
    const sourceFp = categoryFingerprintForDraw(
      sourceCategoryKey,
      sourceParticipants.map((p) => p.entryId),
    )
    await tx.bracketCategoryDraw.update({
      where: { id: sourceDraw.id },
      data: { sourceFingerprint: sourceFp },
    })
    await rebuildDrawAfterCompositionChange(tx, sourceDraw.id, rules, sourceParticipants.length)

    const redrawCategoryKeys = [
      ...(previousDrawCategoryKey ? [previousDrawCategoryKey] : []),
      sourceCategoryKey,
    ]
    await redrawCategoryDrawsInTransaction(tx, {
      baseSeed: draft.baseSeed,
      generationId: draft.id,
      categoryKeys: redrawCategoryKeys,
      eligibleMap,
      resetBoutsReleased: true,
    })

    await tx.bracketMoveAudit.create({
      data: {
        entryId: input.entryId,
        action: 'RESET',
        fromCategoryKey: placementRow.categoryKey,
        toCategoryKey: sourceCategoryKey,
        movedBy: input.movedBy ?? null,
      },
    })

    await tx.bracketGeneration.update({
      where: { id: draft.id },
      data: { version: draft.version + 1 },
    })

    const draftResult = { id: draft.id, version: draft.version + 1 }
    const affectedCategoryKeys = [...new Set([placementRow.categoryKey, sourceCategoryKey])]
    return {
      ok: true,
      draft: draftResult,
      warnings: [],
      affectedCategoryKeys,
    }
  }, BRACKET_MUTATION_TX_OPTIONS)

  const { computeDiffForDraft } = await import('./dashboardDiff')
  const { buildCategoriesCanonicalDto } = await import('./admin/categoryCanonical')
  const diff = await computeDiffForDraft(result.draft.id)
  const categories = await buildCategoriesCanonicalDto(
    result.draft.id,
    result.affectedCategoryKeys ?? [],
  )
  return { ...result, diff, categories }
}
