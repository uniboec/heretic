#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { getActivePublishedGeneration } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

async function main() {
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: published.id, status: 'ACTIVE' },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
  })

  const matches = []

  for (const draw of draws) {
    const names = draw.participants.map((p) => p.snapshotDisplayName ?? '')
    const hasBahtin = names.some((name) => /Бахтин/i.test(name))
    if (!hasBahtin) continue

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

    const categoryKey = draw.categoryKey
    const boutIds = (structure?.rounds ?? []).map((m) => `${categoryKey}::${m.id}`)
    const results = await prisma.boutResult.findMany({
      where: { boutId: { in: boutIds }, isCurrent: true },
    })
    const nameByEntry = new Map(draw.participants.map((p) => [p.entryId, p.snapshotDisplayName]))

    matches.push({
      categoryKey,
      title: getCategoryTitleFromKey(categoryKey),
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
      boutResults: results.map((r) => ({
        boutId: r.boutId,
        winner: nameByEntry.get(r.winnerEntryId ?? '') ?? r.winnerEntryId,
        loser: nameByEntry.get(r.loserEntryId ?? '') ?? r.loserEntryId,
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
