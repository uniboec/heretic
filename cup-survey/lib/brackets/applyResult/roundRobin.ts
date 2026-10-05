import type { Prisma } from '@prisma/client'
import { extractBouts } from '../../bouts/extractBouts'
import { buildSportDependencyGraph, sportDescendantClosure } from '../../bouts/sportDependencies'
import { deserializePublishedStructure } from '../core/snapshot'
import type { ApplyBoutResultContext, ApplyBoutResultOutcome } from '../applyBoutResultToCompetitionStructure'
import type { PublishedDrawPair } from '../generation/publishedDraws'
import { persistPatchedPublishedStructure } from './patchPublishedStructure'

export async function applyRoundRobinBoutResult(
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
    bronzeMode: null,
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
    message: changed ? 'Round-robin pair result recorded' : 'Round-robin result unchanged',
    affectedBoutIds,
  }
}
