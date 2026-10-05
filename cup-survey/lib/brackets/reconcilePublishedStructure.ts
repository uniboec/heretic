import type { Prisma } from '@prisma/client'
import { getCategoryTitleFromKey } from '../registration/categoryIdentity'
import { BracketSystemRegistry } from './core/registry'
import { getEffectiveBronzeMode, getEffectiveSystemId } from './core/formatRules'
import { structureWithDerivedResult, validatePlacements } from './deriveCategoryPlacements'
import { deserializePublishedStructure, serializePublishedStructure } from './core/snapshot'
import { patchStructureWithBoutResult } from './applyResult/patchPublishedStructure'
import { extractBouts } from '../bouts/extractBouts'
import { sortBouts } from '../bouts/sortBouts'
import { lockCompetitionDrawForCategory } from '../bouts/lockCompetitionForBout'

const ACTIVE_BOUT_RESULT_FILTER = {
  isCurrent: true,
  resultStatus: 'ACTIVE',
} as const

export async function reconcileCategoryPublishedStructure(
  tx: Prisma.TransactionClient,
  categoryKey: string,
): Promise<{ reconciled: boolean; boutCount: number }> {
  const pair = await lockCompetitionDrawForCategory(tx, categoryKey)
  const draw = pair.draw
  const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
  if (!effectiveSystemId) {
    return { reconciled: false, boutCount: 0 }
  }

  const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
  const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
  if (draw.systemVersion == null) {
    return { reconciled: false, boutCount: 0 }
  }

  const system = BracketSystemRegistry.get(effectiveSystemId, draw.systemVersion)
  const built = system.build({
    participants: draw.participants.map((participant) => ({
      entryId: participant.entryId,
      displayName: participant.snapshotDisplayName ?? '',
      clubName: participant.snapshotClubName ?? '',
      city: participant.snapshotCity ?? '',
      clubIdentity: `${participant.snapshotClubName ?? ''}::${participant.snapshotCity ?? ''}`,
      publicNumber: participant.snapshotPublicNumber,
      seedPosition: participant.seedPosition,
      seedLocked: participant.seedLocked,
    })),
    drawSeed: draw.drawSeed,
    options: { bronzeMode },
  })

  let structure = structureWithDerivedResult(built, {
    systemId: system.id,
    bronzeMode,
    participantCount: draw.participants.length,
  })

  const categoryMeta = {
    categoryKey: draw.categoryKey,
    categoryTitle: getCategoryTitleFromKey(draw.categoryKey),
    discipline: draw.discipline,
    storedMatIndex: draw.matIndex,
    competitionStage: draw.competitionStage,
  }

  const boutOrder = sortBouts(extractBouts(structure, categoryMeta)).map((bout) => bout.id)

  const results = await tx.boutResult.findMany({
    where: {
      ...ACTIVE_BOUT_RESULT_FILTER,
      boutId: { startsWith: `${categoryKey}::` },
    },
  })

  const resultByBoutId = new Map(
    results.map((result) => [result.boutId, result]),
  )

  const orderedResults = boutOrder
    .map((boutId) => resultByBoutId.get(boutId))
    .filter((result): result is NonNullable<typeof result> => result != null)

  const systemId = snapshot?.systemId ?? effectiveSystemId
  const systemVersion = snapshot?.systemVersion ?? draw.systemVersion ?? 1

  if (orderedResults.length === 0) {
    if (JSON.stringify(snapshot?.structure) === JSON.stringify(structure)) {
      return { reconciled: false, boutCount: 0 }
    }
    if (structure.result) {
      try {
        validatePlacements(structure.result, {
          systemId: effectiveSystemId,
          bronzeMode,
          participantCount: draw.participants.length,
        })
      } catch (error) {
        console.error(
          `[reconcile] Skipped save for ${categoryKey}: invalid placements`,
          error,
        )
        return { reconciled: false, boutCount: 0 }
      }
    }
    await tx.bracketCategoryDraw.update({
      where: { id: draw.id },
      data: {
        publishedStructureJson: serializePublishedStructure({
          systemId,
          systemVersion,
          structure,
        }),
      },
    })
    return { reconciled: true, boutCount: 0 }
  }

  let changed = false
  for (const result of orderedResults) {
    const { structure: patched, changed: patchChanged } = patchStructureWithBoutResult({
      structure,
      boutId: result.boutId,
      winnerEntryId: result.winnerEntryId,
      loserEntryId: result.loserEntryId,
      participants: draw.participants,
      systemId: effectiveSystemId,
      bronzeMode,
      participantCount: draw.participants.length,
    })
    structure = patched
    if (patchChanged) changed = true
  }

  if (!changed && JSON.stringify(snapshot?.structure) === JSON.stringify(structure)) {
    return { reconciled: false, boutCount: orderedResults.length }
  }

  if (structure.result) {
    try {
      validatePlacements(structure.result, {
        systemId: effectiveSystemId,
        bronzeMode,
        participantCount: draw.participants.length,
      })
    } catch (error) {
      console.error(
        `[reconcile] Skipped save for ${categoryKey}: invalid placements`,
        error,
      )
      return { reconciled: false, boutCount: orderedResults.length }
    }
  }

  await tx.bracketCategoryDraw.update({
    where: { id: draw.id },
    data: {
      publishedStructureJson: serializePublishedStructure({
        systemId,
        systemVersion,
        structure,
      }),
    },
  })

  return { reconciled: true, boutCount: orderedResults.length }
}

export async function reconcileAllPublishedStructures(
  tx: Prisma.TransactionClient,
): Promise<{ categories: number; totalBouts: number }> {
  const { getActivePublishedGeneration } = await import('./generation/publishedDraws')
  const generation = await getActivePublishedGeneration(tx)
  if (!generation) {
    return { categories: 0, totalBouts: 0 }
  }

  const draws = await tx.bracketCategoryDraw.findMany({
    where: { generationId: generation.id, status: 'ACTIVE' },
    select: { categoryKey: true },
  })

  let categories = 0
  let totalBouts = 0

  for (const draw of draws) {
    const outcome = await reconcileCategoryPublishedStructure(tx, draw.categoryKey)
    if (outcome.reconciled) {
      categories += 1
      totalBouts += outcome.boutCount
    }
  }

  return { categories, totalBouts }
}
