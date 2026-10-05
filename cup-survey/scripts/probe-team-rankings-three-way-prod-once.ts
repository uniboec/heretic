#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import { buildClubIdentity, isRankableClub } from '../lib/teamRankings/clubIdentity'

async function main() {
  const settings = await prisma.teamRankingSetting.findUnique({
    where: { tournamentScopeId: 'cup-2026' },
  })

  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  const thirdByClub = new Map<string, { clubName: string; city: string; count: number; points: number }>()
  const thirdPlaceRows: Array<Record<string, unknown>> = []

  for (const pair of visiblePairs) {
    const draw = pair.draw
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
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
    const result = readCategoryResult(structure, systemId, {
      participantCount: draw.participants.length,
      bronzeMode: effectiveBronzeMode,
    })

    for (const placement of result?.placements ?? []) {
      if (placement.placement !== 3) continue
      const participant = draw.participants.find((row) => row.entryId === placement.entryId)
      const clubName = participant?.snapshotClubName ?? ''
      const city = participant?.snapshotCity ?? ''
      const counted = isRankableClub(clubName)
      thirdPlaceRows.push({
        categoryKey: draw.categoryKey,
        title: getCategoryTitleFromKey(draw.categoryKey),
        systemId,
        resultStatus: result?.status ?? null,
        athlete: participant?.snapshotDisplayName ?? placement.entryId,
        clubName,
        city,
        reason: placement.reason,
        countedInTeamRanking: counted,
      })
      if (!counted) continue
      const identity = buildClubIdentity(clubName, city)
      const existing = thirdByClub.get(identity) ?? { clubName, city, count: 0, points: 0 }
      existing.count += 1
      existing.points += settings?.thirdPlacePoints ?? 0
      thirdByClub.set(identity, existing)
    }
  }

  const brokenThirds = thirdPlaceRows.filter(
    (row) => row.resultStatus !== 'complete' && row.systemId === 'three_way',
  )
  const completeThirds = thirdPlaceRows.filter((row) => row.resultStatus === 'complete')
  const excludedNoClub = thirdPlaceRows.filter((row) => row.countedInTeamRanking === false)

  console.log(
    JSON.stringify(
      {
        thirdPlacePoints: settings?.thirdPlacePoints ?? null,
        summary: {
          totalThirdPlaceAthletes: thirdPlaceRows.length,
          completeAndCountable: completeThirds.filter((row) => row.countedInTeamRanking).length,
          excludedNoClub: excludedNoClub.length,
          brokenThreeWayThirds: brokenThirds.length,
          clubsWithThirdPlaces: thirdByClub.size,
        },
        clubsWithThirdPlaces: [...thirdByClub.values()].sort((a, b) => b.count - a.count),
        brokenThreeWayThirds: brokenThirds,
        excludedNoClub,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
