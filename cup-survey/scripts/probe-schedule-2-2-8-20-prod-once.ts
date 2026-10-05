#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const NUMS = ['2-2', '2-8', '2-20']

async function main() {
  const executions = await prisma.boutScheduleExecution.findMany({
    where: { frozenScheduleFormatted: { in: NUMS } },
    select: { boutId: true, frozenScheduleFormatted: true, boutPhase: true },
  })

  const categoryKeys = [...new Set(executions.map((e) => e.boutId.split('::')[0]))]
  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { categoryKey: { in: categoryKeys } },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  })

  const byKey = new Map<string, typeof draws[number]>()
  for (const draw of draws) {
    if (!byKey.has(draw.categoryKey)) byKey.set(draw.categoryKey, draw)
  }

  const out = []
  for (const exec of executions.sort((a, b) => a.frozenScheduleFormatted!.localeCompare(b.frozenScheduleFormatted!))) {
    const categoryKey = exec.boutId.split('::')[0]
    const draw = byKey.get(categoryKey)
    if (!draw) continue
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
    const br = await prisma.boutResult.findFirst({
      where: { boutId: exec.boutId, isCurrent: true, resultStatus: 'ACTIVE' },
    })
    const name = (id: string | null | undefined) =>
      draw.participants.find((p) => p.entryId === id)?.snapshotDisplayName ?? id
    const localId = exec.boutId.split('::')[1]
    const match = structure?.rounds.find((m) => m.id === localId)

    out.push({
      scheduleNum: exec.frozenScheduleFormatted,
      categoryTitle: getCategoryTitleFromKey(categoryKey),
      systemId,
      boutLocalId: localId,
      boutLabel: match?.label,
      winner: name(br?.winnerEntryId),
      loser: name(br?.loserEntryId),
      placements: (result?.placements ?? []).map((p) => ({
        placement: p.placement,
        name: name(p.entryId),
        reason: p.reason,
      })),
    })
  }

  const uniqueCategories = [...new Set(out.map((row) => row.categoryTitle))]
  console.log(JSON.stringify({ uniqueCategories, bouts: out }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
