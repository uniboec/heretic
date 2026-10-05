#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const NUMS = ['2-2', '2-8', '2-20']
const NAMES = ['Куликов', 'Петухов', 'Очур-Оол']

async function main() {
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')

  const pairs = await getPublicVisiblePublishedDraws(published)
  const hits = []

  for (const pair of pairs) {
    const draw = pair.draw
    const names = draw.participants.map((p) => p.snapshotDisplayName ?? '')
    const hasAll = NAMES.every((n) => names.some((name) => name.includes(n)))
    if (!hasAll) continue

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

    const boutIds = (structure?.rounds ?? []).map((m) => `${draw.categoryKey}::${m.id}`)
    const executions = await prisma.boutScheduleExecution.findMany({
      where: { boutId: { in: boutIds } },
    })
    const results = await prisma.boutResult.findMany({
      where: { boutId: { in: boutIds }, isCurrent: true, resultStatus: 'ACTIVE' },
    })

    const nameByEntry = new Map(draw.participants.map((p) => [p.entryId, p.snapshotDisplayName]))
    const seedByEntry = new Map(draw.participants.map((p) => [p.entryId, p.seedPosition]))

    hits.push({
      categoryKey: draw.categoryKey,
      title: getCategoryTitleFromKey(draw.categoryKey),
      systemId,
      participants: draw.participants.map((p) => ({
        seed: p.seedPosition,
        name: p.snapshotDisplayName,
      })),
      bouts: structure?.rounds.map((m) => {
        const boutId = `${draw.categoryKey}::${m.id}`
        const exec = executions.find((e) => e.boutId === boutId)
        const br = results.find((r) => r.boutId === boutId)
        return {
          localId: m.id,
          scheduleNum: exec?.frozenScheduleFormatted ?? null,
          label: m.label,
          a: m.participantA?.entryId
            ? `${seedByEntry.get(m.participantA.entryId)} ${nameByEntry.get(m.participantA.entryId)}`
            : m.slotHintA,
          b: m.participantB?.entryId
            ? `${seedByEntry.get(m.participantB.entryId)} ${nameByEntry.get(m.participantB.entryId)}`
            : m.slotHintB,
          winner: nameByEntry.get(m.winnerEntryId ?? '') ?? m.winnerEntryId,
          loser: nameByEntry.get(m.loserEntryId ?? '') ?? m.loserEntryId,
          dbWinner: nameByEntry.get(br?.winnerEntryId ?? '') ?? br?.winnerEntryId,
        }
      }),
      placements: (result?.placements ?? []).map((p) => ({
        placement: p.placement,
        reason: p.reason,
        name: nameByEntry.get(p.entryId),
      })),
    })
  }

  console.log(JSON.stringify(hits, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
