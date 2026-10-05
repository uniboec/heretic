#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import { buildClubIdentity, isRankableClub } from '../lib/teamRankings/clubIdentity'

type ThirdRow = { entryId: string; name: string; club: string | null; rankable: boolean }

function thirdKey(rows: ThirdRow[]) {
  return [...rows]
    .sort((a, b) => a.entryId.localeCompare(b.entryId))
    .map((row) => row.entryId)
}

async function main() {
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  const awardQueues = await prisma.awardCeremonyQueue.findMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    include: { placements: { orderBy: { placementIndex: 'asc' } } },
  })
  const awardByCategory = new Map(awardQueues.map((row) => [row.categoryKey, row]))

  const categoryAudits = []
  const teamThirdByClub = new Map<string, number>()

  let bracketThirdTotal = 0
  let bracketThirdRankable = 0
  let awardsThirdTotal = 0
  let awardsThirdPendingOnly = 0
  let teamThirdTotal = 0

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

    const nameByEntry = new Map(
      draw.participants.map((p) => [p.entryId, p.snapshotDisplayName ?? p.entryId]),
    )
    const clubByEntry = new Map(
      draw.participants.map((p) => [p.entryId, p.snapshotClubName ?? '']),
    )
    const cityByEntry = new Map(draw.participants.map((p) => [p.entryId, p.snapshotCity ?? '']))

    const bracketThirds: ThirdRow[] = (result?.placements ?? [])
      .filter((p) => p.placement === 3)
      .map((p) => {
        const club = clubByEntry.get(p.entryId) ?? ''
        return {
          entryId: p.entryId,
          name: nameByEntry.get(p.entryId) ?? p.entryId,
          club,
          rankable: isRankableClub(club),
        }
      })

    const award = awardByCategory.get(draw.categoryKey)
    const awardThirds: ThirdRow[] = (award?.placements ?? [])
      .filter((p) => p.placement === 3)
      .map((p) => ({
        entryId: p.entryId,
        name: `${p.lastName} ${p.firstName}`.trim(),
        club: p.clubName,
        rankable: isRankableClub(p.clubName),
      }))

    const awardThirdsPending: ThirdRow[] = (award?.placements ?? [])
      .filter((p) => p.placement === 3 && p.status === 'NOT_AWARDED')
      .map((p) => ({
        entryId: p.entryId,
        name: `${p.lastName} ${p.firstName}`.trim(),
        club: p.clubName,
        rankable: isRankableClub(p.clubName),
      }))

    if (result?.status === 'complete') {
      bracketThirdTotal += bracketThirds.length
      for (const third of bracketThirds) {
        if (!third.rankable) continue
        bracketThirdRankable += 1
        teamThirdTotal += 1
        const clubIdentity = buildClubIdentity(third.club ?? '', cityByEntry.get(third.entryId) ?? '')
        teamThirdByClub.set(clubIdentity, (teamThirdByClub.get(clubIdentity) ?? 0) + 1)
      }
    }
    awardsThirdTotal += awardThirds.length
    awardsThirdPendingOnly += awardThirdsPending.length

    const issues: string[] = []
    if (result?.status === 'complete' && bracketThirds.length === 0 && draw.participants.length >= 3) {
      issues.push('bracket_complete_missing_third')
    }
    if (result?.status === 'complete' && !award) {
      issues.push('award_queue_missing')
    }
    if (result?.status === 'complete' && award && bracketThirds.length !== awardThirds.length) {
      issues.push(`third_count_mismatch:bracket=${bracketThirds.length},award=${awardThirds.length}`)
    }
    if (
      result?.status === 'complete' &&
      award &&
      thirdKey(bracketThirds).join('|') !== thirdKey(awardThirds).join('|')
    ) {
      issues.push('third_entries_mismatch')
    }
    if (result?.status !== 'complete' && awardThirds.length > 0) {
      issues.push('award_third_before_bracket_complete')
    }
    if (bracketThirds.some((row, index, rows) => rows.findIndex((x) => x.entryId === row.entryId) !== index)) {
      issues.push('bracket_duplicate_third_entry')
    }

    if (issues.length > 0 || bracketThirds.length > 0 || awardThirds.length > 0) {
      categoryAudits.push({
        categoryKey: draw.categoryKey,
        title: getCategoryTitleFromKey(draw.categoryKey),
        discipline: draw.discipline,
        bracketStatus: result?.status ?? null,
        participantCount: draw.participants.length,
        bracketThirdCount: bracketThirds.length,
        awardThirdCount: awardThirds.length,
        awardThirdPendingCount: awardThirdsPending.length,
        awardQueueStatus: award?.status ?? null,
        bracketThirds: bracketThirds.map((row) => ({
          name: row.name,
          club: row.club,
          rankable: row.rankable,
        })),
        awardThirds: awardThirds.map((row) => ({
          name: row.name,
          club: row.club,
          rankable: row.rankable,
        })),
        issues,
      })
    }
  }

  const globalIssues: string[] = []
  if (bracketThirdRankable !== teamThirdTotal) {
    globalIssues.push(`team_third_total_mismatch:bracket_rankable=${bracketThirdRankable},team=${teamThirdTotal}`)
  }
  if (bracketThirdTotal !== awardsThirdTotal) {
    globalIssues.push(`awards_third_total_mismatch:bracket=${bracketThirdTotal},awards=${awardsThirdTotal}`)
  }

  const brokenCategories = categoryAudits.filter((row) => row.issues.length > 0)

  console.log(
    JSON.stringify(
      {
        summary: {
          visibleCategories: visiblePairs.length,
          completeCategories: categoryAudits.filter((row) => row.bracketStatus === 'complete').length,
          bracketThirdTotal,
          bracketThirdRankable,
          awardsThirdTotal,
          awardsThirdPendingOnly,
          teamThirdTotal,
          globalIssues,
          brokenCategoryCount: brokenCategories.length,
          teamThirdByClub: [...teamThirdByClub.entries()]
            .map(([club, thirdPlaces]) => ({ club, thirdPlaces }))
            .sort((a, b) => b.thirdPlaces - a.thirdPlaces || a.club.localeCompare(b.club, 'ru')),
        },
        brokenCategories,
        allCategoriesWithThirds: categoryAudits.filter(
          (row) => row.bracketThirdCount > 0 || row.awardThirdCount > 0,
        ),
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
