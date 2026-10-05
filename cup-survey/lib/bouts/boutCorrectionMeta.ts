import type { Prisma } from '@prisma/client'
import { getEffectiveSystemId } from '../brackets/core/formatRules'
import { deserializePublishedStructure } from '../brackets/core/snapshot'
import {
  getActivePublishedDrawByCategoryKey,
  getActivePublishedGeneration,
} from '../brackets/generation/publishedDraws'
import { extractBouts } from './extractBouts'
import { resolveDownstreamBoutIds } from './sportDependencies'
import type { InternalBout } from './types'

export type BoutCorrectionMeta = {
  systemId: string
  downstreamBoutIds: string[]
}

export async function loadBoutCorrectionMeta(
  tx: Prisma.TransactionClient,
  bout: InternalBout,
): Promise<BoutCorrectionMeta> {
  const generation = await getActivePublishedGeneration(tx)
  if (!generation) {
    return { systemId: 'olympic', downstreamBoutIds: [] }
  }

  const pair = await getActivePublishedDrawByCategoryKey(generation, bout.categoryKey, tx)
  if (!pair) {
    return { systemId: 'olympic', downstreamBoutIds: [] }
  }

  const systemId =
    getEffectiveSystemId(pair.draw.autoSystemId, pair.draw.systemOverride) ?? 'olympic'
  const snapshot = deserializePublishedStructure(pair.draw.publishedStructureJson)
  if (!snapshot) {
    return { systemId, downstreamBoutIds: [] }
  }

  const categoryMeta = {
    categoryKey: pair.draw.categoryKey,
    categoryTitle: pair.draw.categoryTitle,
    discipline: pair.draw.discipline,
    storedMatIndex: pair.draw.matIndex,
    competitionStage: pair.draw.competitionStage,
  }
  const bouts = extractBouts(snapshot.structure, categoryMeta)
  const downstreamBoutIds = resolveDownstreamBoutIds(bout.id, bouts)

  return { systemId, downstreamBoutIds }
}
