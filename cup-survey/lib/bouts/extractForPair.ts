import { getCategoryTitleFromKey } from '../registration/categoryIdentity'
import { categoryRequiresBouts } from '../brackets/core/categoryRequiresBouts'
import { readPublishedStructure } from '../brackets/core/readPublishedStructure'
import { getEffectiveBronzeMode } from '../brackets/core/formatRules'
import type { PublishedDrawPair } from '../brackets/generation/publishedDraws'
import { extractBouts, type BoutParticipantLookup } from './extractBouts'
import type { InternalBout } from './types'

function buildParticipantLookup(
  participants: PublishedDrawPair['draw']['participants'],
): BoutParticipantLookup {
  return new Map(
    participants.map((participant) => [
      participant.entryId,
      {
        displayName: participant.snapshotDisplayName ?? '',
        clubName: participant.snapshotClubName ?? '',
        city: participant.snapshotCity ?? '',
        publicNumber: participant.snapshotPublicNumber,
      },
    ]),
  )
}

export function extractPlayableBoutsForPair(pair: PublishedDrawPair): InternalBout[] {
  const draw = pair.draw
  if (
    !categoryRequiresBouts({
      status: draw.status,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
      participantCount: draw.participants.length,
    })
  ) {
    return []
  }

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

  const category = {
    categoryKey: draw.categoryKey,
    categoryTitle: getCategoryTitleFromKey(draw.categoryKey),
    discipline: draw.discipline,
    storedMatIndex: draw.matIndex ?? null,
    competitionStage: draw.competitionStage,
  }

  return extractBouts(structure, category, buildParticipantLookup(draw.participants))
}
