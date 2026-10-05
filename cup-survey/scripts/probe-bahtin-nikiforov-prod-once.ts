#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const NIKIFOROV = '99640cb8-ca34-41e2-91f2-ea6e139b205e'

async function main() {
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')

  const pairs = await getPublicVisiblePublishedDraws(published)
  const matches = []

  for (const pair of pairs) {
    const draw = pair.draw
    const names = draw.participants.map((p) => p.snapshotDisplayName ?? '')
    const hasNikiforov = draw.participants.some((p) => p.entryId === NIKIFOROV)
    const hasBahtin = names.some((name) => name.includes('Бахтин'))
    if (!hasNikiforov || !hasBahtin) continue

    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
    const structure = readPublishedStructure({
      publishedStructureJson: draw.publishedStructureJson,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
      systemVersion: draw.systemVersion,
      autoBronzeMode: draw.autoBronzeMode,
      bronzeModeOverride: draw.bronzeModeOverride,
      drawSeed: draw.drawSeed,
      participants: draw.participants,
      effectiveBronzeMode: bronzeMode,
    })
    const result = readCategoryResult(structure, systemId, {
      participantCount: draw.participants.length,
      bronzeMode,
    })

    const nameByEntry = new Map(draw.participants.map((p) => [p.entryId, p.snapshotDisplayName]))

    matches.push({
      categoryKey: draw.categoryKey,
      title: getCategoryTitleFromKey(draw.categoryKey),
      systemId,
      participantCount: draw.participants.length,
      participants: draw.participants.map((p) => ({
        entryId: p.entryId,
        name: p.snapshotDisplayName,
        club: p.snapshotClubName,
      })),
      rounds: structure?.rounds.map((m) => ({
        id: m.id,
        winner: nameByEntry.get(m.winnerEntryId ?? '') ?? m.winnerEntryId,
        loser: nameByEntry.get(m.loserEntryId ?? '') ?? m.loserEntryId,
      })),
      placements: (result?.placements ?? []).map((p) => ({
        placement: p.placement,
        name: nameByEntry.get(p.entryId),
        entryId: p.entryId,
      })),
    })
  }

  console.log(JSON.stringify(matches, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
