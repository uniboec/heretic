#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import { buildClubIdentity, isRankableClub } from '../lib/teamRankings/clubIdentity'

type PlacementRow = { placement: number; entryId: string; name: string | null; club: string | null }

function normalizePlacements(rows: PlacementRow[]) {
  return [...rows]
    .sort((a, b) => a.placement - b.placement || (a.name ?? '').localeCompare(b.name ?? '', 'ru'))
    .map((row) => `${row.placement}:${row.entryId}`)
}

async function main() {
  const settings = await prisma.teamRankingSetting.findUnique({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
  })

  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  const awardQueues = await prisma.awardCeremonyQueue.findMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    include: { placements: { orderBy: { placementIndex: 'asc' } } },
  })
  const awardByCategory = new Map(awardQueues.map((row) => [row.categoryKey, row]))

  const teamThirdByClub = new Map<string, number>()
  const teamPointsByClub = new Map<string, number>()

  const audits = []

  for (const pair of visiblePairs) {
    const draw = pair.draw
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    if (systemId !== 'three_way') continue

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
      select: { boutId: true, boutPhase: true },
    })
    const allConfirmed =
      boutIds.length > 0 &&
      executions.length === boutIds.length &&
      executions.every((row) => row.boutPhase === 'confirmed')

    const nameByEntry = new Map(
      draw.participants.map((p) => [p.entryId, p.snapshotDisplayName ?? p.entryId]),
    )
    const clubByEntry = new Map(
      draw.participants.map((p) => [p.entryId, p.snapshotClubName ?? '']),
    )

    const bracketPlacements: PlacementRow[] = (result?.placements ?? []).map((p) => ({
      placement: p.placement,
      entryId: p.entryId,
      name: nameByEntry.get(p.entryId) ?? null,
      club: clubByEntry.get(p.entryId) ?? null,
    }))

    const award = awardByCategory.get(draw.categoryKey)
    const awardPlacements: PlacementRow[] = (award?.placements ?? []).map((p) => ({
      placement: p.placement,
      entryId: p.entryId,
      name: `${p.lastName} ${p.firstName}`.trim(),
      club: p.clubName,
    }))

    for (const placement of bracketPlacements) {
      if (!isRankableClub(placement.club ?? '')) continue
      const identity = buildClubIdentity(placement.club ?? '', draw.participants.find((p) => p.entryId === placement.entryId)?.snapshotCity ?? '')
      if (placement.placement === 3) {
        teamThirdByClub.set(identity, (teamThirdByClub.get(identity) ?? 0) + 1)
      }
      const points =
        placement.placement === 1
          ? settings?.firstPlacePoints ?? 0
          : placement.placement === 2
            ? settings?.secondPlacePoints ?? 0
            : placement.placement === 3
              ? settings?.thirdPlacePoints ?? 0
              : 0
      teamPointsByClub.set(identity, (teamPointsByClub.get(identity) ?? 0) + points)
    }

    const bracketKey = normalizePlacements(bracketPlacements)
    const awardKey = normalizePlacements(awardPlacements)

    const issues: string[] = []
    if (allConfirmed && bracketPlacements.length !== 3) {
      issues.push(`bracket_missing_placements:${bracketPlacements.length}`)
    }
    if (allConfirmed && result?.status !== 'complete') {
      issues.push(`bracket_status_${result?.status ?? 'null'}`)
    }
    if (allConfirmed && !award) {
      issues.push('award_queue_missing')
    }
    if (allConfirmed && award && awardPlacements.length !== 3) {
      issues.push(`award_missing_placements:${awardPlacements.length}`)
    }
    if (allConfirmed && bracketKey.join('|') !== awardKey.join('|')) {
      issues.push('award_mismatch_bracket')
    }
    if (!allConfirmed && award && awardPlacements.length > 0) {
      issues.push('award_present_before_complete')
    }

    audits.push({
      categoryKey: draw.categoryKey,
      title: getCategoryTitleFromKey(draw.categoryKey),
      allBoutsConfirmed: allConfirmed,
      confirmedBouts: executions.filter((row) => row.boutPhase === 'confirmed').length,
      boutCount: boutIds.length,
      bracketStatus: result?.status ?? null,
      bracketPlacements,
      awardStatus: award?.status ?? null,
      awardPlacements,
      issues,
      ok: issues.length === 0,
    })
  }

  // Simulate team ranking medal counts from all visible categories (not only three_way)
  const teamMedalsFromAllCategories = { first: 0, second: 0, third: 0 }
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
    for (const placement of result?.placements ?? []) {
      const participant = draw.participants.find((p) => p.entryId === placement.entryId)
      if (!participant || !isRankableClub(participant.snapshotClubName ?? '')) continue
      if (placement.placement === 1) teamMedalsFromAllCategories.first += 1
      if (placement.placement === 2) teamMedalsFromAllCategories.second += 1
      if (placement.placement === 3) teamMedalsFromAllCategories.third += 1
    }
  }

  const summary = {
    totalThreeWay: audits.length,
    completeOk: audits.filter((row) => row.ok && row.allBoutsConfirmed).length,
    completeBroken: audits.filter((row) => row.allBoutsConfirmed && !row.ok).length,
    inProgress: audits.filter((row) => !row.allBoutsConfirmed).length,
    threeWayThirdPlacesInTeamAudit: [...teamThirdByClub.entries()].map(([club, count]) => ({
      club,
      thirdPlaces: count,
      pointsFromThreeWay: (settings?.thirdPlacePoints ?? 0) * count,
    })),
    totalMedalsCountableAllCategories: teamMedalsFromAllCategories,
  }

  console.log(JSON.stringify({ summary, audits }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
