import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { loadEligibleEntries } from '../core/eligibility'
import { computeCategoryCompositionFingerprint } from '../core/fingerprint'
import { compactSeedPositions } from '../core/seeding/validateSeeds'
import { getCategoryTitleFromKey } from '../../registration/categoryIdentity'
import { computeCategoryDrawSeed } from '../generation/ensureDraft'
import { rebuildDrawAfterCompositionChange } from '../generation/rebuildDraw'
import { redrawCategoryDrawsInTransaction } from '../generation/redraw'
import {
  ensureLivePublicationPointers,
  upsertPublicationPointer,
} from '../generation/publicationState'
import { ImpactChangedError } from './errors'
import { computeImpactForForceRebuild } from './impact'
import { impactMatches, verifyImpactToken } from './impactToken'
import { acquireBracketWriteLocks } from './locks'

async function teardownEmptyCategoryPublication(
  tx: Prisma.TransactionClient,
  categoryKey: string,
): Promise<void> {
  await tx.bracketPublicationState.updateMany({
    where: { categoryKey },
    data: {
      visible: false,
      boutsReleased: false,
      boutMatAssignments: Prisma.DbNull,
      matCountAtRelease: null,
    },
  })
  await tx.bracketPublicationState.deleteMany({ where: { categoryKey } })
}

async function syncDrawParticipants(
  tx: Prisma.TransactionClient,
  drawId: string,
  entries: Array<{ entryId: string; effectiveCategoryKey: string }>,
): Promise<void> {
  const existingParticipants = await tx.bracketDrawParticipant.findMany({
    where: { drawId },
  })
  const orderMap = new Map(
    existingParticipants.map((participant) => [
      participant.entryId,
      { seedPosition: participant.seedPosition, seedLocked: participant.seedLocked },
    ]),
  )

  const entryIds = new Set(entries.map((entry) => entry.entryId))
  for (const participant of existingParticipants) {
    if (!entryIds.has(participant.entryId)) {
      await tx.bracketDrawParticipant.delete({ where: { id: participant.id } })
    }
  }

  let pos = 1
  const usedPositions = new Set<number>()
  const seedAssignments: Array<{
    entryId: string
    seedPosition: number
    seedLocked: boolean
  }> = []

  for (const entry of entries) {
    const prev = orderMap.get(entry.entryId)
    let seedPosition = prev?.seedPosition ?? pos
    while (usedPositions.has(seedPosition)) seedPosition += 1
    usedPositions.add(seedPosition)
    pos = Math.max(pos, seedPosition + 1)
    seedAssignments.push({
      entryId: entry.entryId,
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
}

export async function forceRebuildCategories(
  tx: Prisma.TransactionClient,
  input: {
    generationId: string
    categoryKeys: string[]
    preserveVisible?: boolean
  },
): Promise<void> {
  const settings =
    (await tx.bracketPageSetting.findUnique({ where: { id: 'default' } })) ?? {
      includePaid: true,
      includeUnpaid: false,
    }
  const rules = await tx.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
  const preserveVisible = input.preserveVisible ?? false
  const eligible = await loadEligibleEntries(
    {
      includePaid: settings.includePaid,
      includeUnpaid: settings.includeUnpaid,
    },
    { tx },
  )
  const byCategory = new Map<string, typeof eligible>()
  for (const entry of eligible) {
    const list = byCategory.get(entry.effectiveCategoryKey) ?? []
    list.push(entry)
    byCategory.set(entry.effectiveCategoryKey, list)
  }

  const generation = await tx.bracketGeneration.findUniqueOrThrow({
    where: { id: input.generationId },
  })

  for (const categoryKey of [...new Set(input.categoryKeys)].sort()) {
    const entries = byCategory.get(categoryKey) ?? []
    let draw = await tx.bracketCategoryDraw.findUnique({
      where: { generationId_categoryKey: { generationId: input.generationId, categoryKey } },
      include: { participants: true },
    })

    if (entries.length === 0) {
      if (draw) {
        await teardownEmptyCategoryPublication(tx, categoryKey)
        await tx.bracketCategoryDraw.delete({ where: { id: draw.id } })
      }
      continue
    }

    if (!draw) {
      const discipline = categoryKey.split(':')[0]
      draw = await tx.bracketCategoryDraw.create({
        data: {
          generationId: input.generationId,
          categoryKey,
          discipline,
          title: getCategoryTitleFromKey(categoryKey),
          drawSeed: computeCategoryDrawSeed(generation.baseSeed, categoryKey, 0),
          redrawRevision: 0,
        },
        include: { participants: true },
      })
      await upsertPublicationPointer(tx, categoryKey, draw.id, false)
    }

    const redrawRevision = draw.redrawRevision + 1
    const drawSeed = computeCategoryDrawSeed(generation.baseSeed, categoryKey, redrawRevision)

    await tx.bracketCategoryDraw.update({
      where: { id: draw.id },
      data: {
        redrawRevision,
        drawSeed,
        seedingFingerprint: null,
        drawInputFingerprint: null,
        title: getCategoryTitleFromKey(categoryKey),
      },
    })

    await tx.bracketPublicationState.updateMany({
      where: { categoryKey },
      data: {
        boutsReleased: false,
        boutMatAssignments: Prisma.DbNull,
        matCountAtRelease: null,
        ...(preserveVisible ? {} : { visible: false }),
      },
    })

    await syncDrawParticipants(
      tx,
      draw.id,
      entries.map((entry) => ({
        entryId: entry.entryId,
        effectiveCategoryKey: entry.effectiveCategoryKey,
      })),
    )

    const fingerprint = computeCategoryCompositionFingerprint(
      entries.map((entry) => ({
        entryId: entry.entryId,
        effectiveCategoryKey: entry.effectiveCategoryKey,
      })),
    )
    await tx.bracketCategoryDraw.update({
      where: { id: draw.id },
      data: { sourceFingerprint: fingerprint },
    })

    await rebuildDrawAfterCompositionChange(tx, draw.id, rules, entries.length)
  }

  await redrawCategoryDrawsInTransaction(tx, {
    baseSeed: generation.baseSeed,
    generationId: input.generationId,
    categoryKeys: [...new Set(input.categoryKeys)],
    eligibleMap: new Map(eligible.map((entry) => [entry.entryId, entry])),
    resetBoutsReleased: false,
  })

  await ensureLivePublicationPointers(tx, input.generationId)
}

export async function forceRebuildCategoriesStandalone(input: {
  categoryKeys: string[]
  expectedVersion: number
  impactToken?: string
}): Promise<{ ok: true; generation: { id: string; version: number } }> {
  return prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, {
      scope: 'destructive_admin',
    })

    if (ctx.generation.version !== input.expectedVersion) {
      const { VersionConflictError } = await import('../core/errors')
      throw new VersionConflictError()
    }

    if (!input.impactToken) {
      const { DestructiveConfirmRequiredError } = await import('./errors')
      throw new DestructiveConfirmRequiredError()
    }

    const tokenPayload = verifyImpactToken(input.impactToken)
      const actualImpact = await computeImpactForForceRebuild(tx, input.categoryKeys)
      if (
        !impactMatches(tokenPayload, {
          operation: 'standalone_force_rebuild',
          mutationFingerprint: actualImpact.mutationFingerprint,
          liveGenerationId: actualImpact.liveGenerationId,
          liveGenerationVersion: actualImpact.liveGenerationVersion,
          affectedCategoryKeys: actualImpact.affectedCategoryKeys,
        lockLevels: actualImpact.lockLevels,
      })
    ) {
      throw new ImpactChangedError({
        affectedCategoryKeys: actualImpact.affectedCategoryKeys,
        lockLevels: actualImpact.lockLevels,
      })
    }

    await forceRebuildCategories(tx, {
      generationId: ctx.generation.id,
      categoryKeys: input.categoryKeys,
      preserveVisible: true,
    })

    const updated = await tx.bracketGeneration.update({
      where: { id: ctx.generation.id },
      data: { version: ctx.generation.version + 1 },
    })

    return { ok: true, generation: { id: updated.id, version: updated.version } }
  })
}
