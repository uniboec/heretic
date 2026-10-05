import type { Prisma } from '@prisma/client'
import { buildSportDependencyGraph, sportDescendantClosure } from '../../bouts/sportDependencies'
import { extractBouts } from '../../bouts/extractBouts'
import { deserializePublishedStructure } from '../core/snapshot'
import type { ApplyBoutResultContext, ApplyBoutResultOutcome } from '../applyBoutResultToCompetitionStructure'
import { persistPatchedPublishedStructure } from './patchPublishedStructure'
import { getEffectiveBronzeMode } from '../core/formatRules'
import type { PublishedDrawPair } from '../generation/publishedDraws'

export async function applyOlympicBoutResult(
  tx: Prisma.TransactionClient,
  ctx: ApplyBoutResultContext,
  pair: PublishedDrawPair,
): Promise<ApplyBoutResultOutcome> {
  const snapshot = deserializePublishedStructure(pair.draw.publishedStructureJson)
  if (!snapshot) {
    return {
      applied: false,
      systemId: ctx.systemId,
      message: 'Published structure snapshot missing',
      affectedBoutIds: [],
    }
  }

  const bronzeMode = getEffectiveBronzeMode(pair.draw.autoBronzeMode, pair.draw.bronzeModeOverride)

  const changed = await persistPatchedPublishedStructure({
    tx,
    drawId: pair.draw.id,
    categoryKey: pair.draw.categoryKey,
    publishedStructureJson: pair.draw.publishedStructureJson,
    boutId: ctx.boutId,
    winnerEntryId: ctx.winnerEntryId,
    loserEntryId: ctx.loserEntryId,
    participants: pair.draw.participants,
    systemId: ctx.systemId,
    bronzeMode,
    participantCount: pair.draw.participants.length,
  })

  const categoryMeta = {
    categoryKey: pair.draw.categoryKey,
    categoryTitle: pair.draw.categoryTitle,
    discipline: pair.draw.discipline,
    storedMatIndex: pair.draw.matIndex,
    competitionStage: pair.draw.competitionStage,
  }
  const bouts = extractBouts(snapshot.structure, categoryMeta)
  const boutIds = new Set(bouts.map((bout) => bout.id))
  const graph = buildSportDependencyGraph(bouts, boutIds)
  const affectedBoutIds = [...sportDescendantClosure([ctx.boutId], graph)]

  return {
    applied: changed,
    systemId: ctx.systemId,
    message: changed ? 'Olympic slots propagated' : 'No downstream slots to fill',
    affectedBoutIds,
  }
}
