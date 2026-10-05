#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'

import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import { loadFullScheduleSnapshot, buildScheduledMats } from '../lib/bouts/scheduleService'

async function main() {
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  const snapshot = await loadFullScheduleSnapshot(prisma, { adminPreview: true })
  const scheduled = buildScheduledMats({
    grouped: snapshot.grouped,
    snapshot,
    now: new Date(),
  })
  const scheduledIds = new Set(scheduled.mats.flatMap((m) => m.bouts.map((b) => b.id)))

  let bracketBoutTotal = 0
  let bracketBoutsNotScheduled = 0
  const awardIssues: Array<{ categoryKey: string; title: string; status: string }> = []

  const awards = await prisma.awardCeremonyQueue.findMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    select: { categoryKey: true, status: true },
  })
  const awardMap = new Map(awards.map((a) => [a.categoryKey, a.status]))

  for (const pair of visiblePairs) {
    const draw = pair.draw
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

    const boutIds = [
      ...(structure?.rounds ?? []).map((m) => `${draw.categoryKey}::${m.id}`),
      ...(structure?.bronzeSlots ?? []).map((s) => `${draw.categoryKey}::${s.id}`),
    ]
    bracketBoutTotal += boutIds.length
    bracketBoutsNotScheduled += boutIds.filter((id) => !scheduledIds.has(id)).length

    const awardStatus = awardMap.get(draw.categoryKey)
    if (result?.status === 'complete' && awardStatus && awardStatus !== 'COMPLETED') {
      awardIssues.push({
        categoryKey: draw.categoryKey,
        title: getCategoryTitleFromKey(draw.categoryKey),
        status: awardStatus,
      })
    }
    if (result?.status === 'complete' && !awardStatus) {
      awardIssues.push({
        categoryKey: draw.categoryKey,
        title: getCategoryTitleFromKey(draw.categoryKey),
        status: 'MISSING_QUEUE',
      })
    }
  }

  const duplicateFrozen = await prisma.$queryRaw<Array<{ formatted: string; count: bigint }>>`
    SELECT "frozenScheduleFormatted" as formatted, count(*)::bigint as count
    FROM "BoutScheduleExecution"
    WHERE "frozenScheduleFormatted" IS NOT NULL
    GROUP BY "frozenScheduleFormatted"
    HAVING count(*) > 1
  `

  console.log(
    JSON.stringify(
      {
        bracketBoutTotal,
        scheduledBoutCount: scheduledIds.size,
        bracketBoutsNotScheduled,
        awardIssues,
        duplicateFrozenNumbers: duplicateFrozen.map((row) => ({
          formatted: row.formatted,
          count: Number(row.count),
        })),
        awardStatusBreakdown: awards.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = (acc[row.status] ?? 0) + 1
          return acc
        }, {}),
      },
      null,
      2,
    ),
  )
}

main().finally(async () => prisma.$disconnect())
