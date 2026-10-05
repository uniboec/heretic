import type { CategoryPlacement } from '@/lib/brackets/core/types'
import { collectFightClubIdentities, resolveWinnerClubIdentity } from './boutStats'
import { buildClubIdentity, isRankableClub } from './clubIdentity'
import { matchesTeamRankingDiscipline } from './discipline'
import type {
  TeamRankingAccumulator,
  TeamRankingCategorySource,
  TeamRankingDisciplineFilter,
  TeamRankingRow,
  TeamRankingSettings,
  TeamRankingStatus,
} from './types'

function createEmptyAccumulator(clubIdentity: string, clubName: string, city: string): TeamRankingAccumulator {
  return {
    clubIdentity,
    clubName,
    city,
    points: 0,
    firstPlaces: 0,
    secondPlaces: 0,
    thirdPlaces: 0,
    wins: 0,
    fights: 0,
  }
}

function buildEntryClubMap(
  categories: TeamRankingCategorySource[],
): Map<string, { clubIdentity: string; clubName: string; city: string }> {
  const map = new Map<string, { clubIdentity: string; clubName: string; city: string }>()

  for (const category of categories) {
    for (const participant of category.participants) {
      if (!isRankableClub(participant.clubName)) {
        continue
      }
      map.set(participant.entryId, {
        clubIdentity: buildClubIdentity(participant.clubName, participant.city),
        clubName: participant.clubName,
        city: participant.city,
      })
    }
  }

  return map
}

function seedClubRows(
  categories: TeamRankingCategorySource[],
  rowsByClub: Map<string, TeamRankingAccumulator>,
): void {
  for (const category of categories) {
    for (const participant of category.participants) {
      if (!isRankableClub(participant.clubName)) {
        continue
      }
      const clubIdentity = buildClubIdentity(participant.clubName, participant.city)
      if (!rowsByClub.has(clubIdentity)) {
        rowsByClub.set(
          clubIdentity,
          createEmptyAccumulator(clubIdentity, participant.clubName, participant.city),
        )
      }
    }
  }
}

function getPlacementPoints(placement: CategoryPlacement, settings: TeamRankingSettings): number {
  if (placement.placement === 1) {
    if (placement.reason === 'SINGLE_PARTICIPANT') {
      switch (settings.soloParticipantPointsMode) {
        case 'EXCLUDE':
          return 0
        case 'CUSTOM':
          return settings.soloParticipantFirstPlacePoints ?? 0
        case 'STANDARD':
        default:
          return settings.firstPlacePoints
      }
    }
    return settings.firstPlacePoints
  }
  if (placement.placement === 2) {
    return settings.secondPlacePoints
  }
  if (placement.placement === 3) {
    return settings.thirdPlacePoints
  }
  return 0
}

function incrementPlacementCounter(row: TeamRankingAccumulator, placement: number): void {
  if (placement === 1) {
    row.firstPlaces += 1
  } else if (placement === 2) {
    row.secondPlaces += 1
  } else if (placement === 3) {
    row.thirdPlaces += 1
  }
}

export type TeamRankingMetrics = Pick<
  TeamRankingRow,
  'points' | 'firstPlaces' | 'secondPlaces' | 'thirdPlaces' | 'wins'
>

export function hasSameRankingMetrics(
  left: TeamRankingMetrics,
  right: TeamRankingMetrics,
): boolean {
  return (
    left.points === right.points &&
    left.firstPlaces === right.firstPlaces &&
    left.secondPlaces === right.secondPlaces &&
    left.thirdPlaces === right.thirdPlaces &&
    left.wins === right.wins
  )
}

export function compareTeamRankingMetrics(
  left: TeamRankingMetrics,
  right: TeamRankingMetrics,
): number {
  if (right.points !== left.points) return right.points - left.points
  if (right.firstPlaces !== left.firstPlaces) return right.firstPlaces - left.firstPlaces
  if (right.secondPlaces !== left.secondPlaces) return right.secondPlaces - left.secondPlaces
  if (right.thirdPlaces !== left.thirdPlaces) return right.thirdPlaces - left.thirdPlaces
  if (right.wins !== left.wins) return right.wins - left.wins
  return 0
}

function compareTeamRowsDisplayOrder(left: TeamRankingRow, right: TeamRankingRow): number {
  const metricsCompare = compareTeamRankingMetrics(left, right)
  if (metricsCompare !== 0) return metricsCompare

  const nameCompare = left.clubName.localeCompare(right.clubName, 'ru')
  if (nameCompare !== 0) return nameCompare

  const cityCompare = left.city.localeCompare(right.city, 'ru')
  if (cityCompare !== 0) return cityCompare

  return left.clubIdentity.localeCompare(right.clubIdentity, 'ru')
}

export function assignRanks(sortedRows: TeamRankingRow[]): TeamRankingRow[] {
  const ranked: TeamRankingRow[] = []

  for (let index = 0; index < sortedRows.length; index += 1) {
    const current = sortedRows[index]
    if (index === 0) {
      ranked.push({ ...current, rank: 1 })
      continue
    }

    const previous = sortedRows[index - 1]
    ranked.push({
      ...current,
      rank: hasSameRankingMetrics(previous, current)
        ? (ranked[index - 1]?.rank ?? index + 1)
        : index + 1,
    })
  }

  return ranked
}

export function rankTeamRows(rows: TeamRankingRow[]): TeamRankingRow[] {
  return assignRanks([...rows].sort(compareTeamRowsDisplayOrder))
}

export function computeRankingStatus(categories: TeamRankingCategorySource[]): TeamRankingStatus {
  if (categories.length === 0) {
    return 'in_progress'
  }

  const complete = categories.every((category) => category.result?.status === 'complete')
  return complete ? 'complete' : 'in_progress'
}

export function aggregateTeamRankings(options: {
  categories: TeamRankingCategorySource[]
  discipline: TeamRankingDisciplineFilter
  settings: TeamRankingSettings
}): { rows: TeamRankingRow[]; rankingStatus: TeamRankingStatus } {
  const relevantCategories = options.categories.filter((category) =>
    matchesTeamRankingDiscipline(category.discipline, options.discipline),
  )

  const rowsByClub = new Map<string, TeamRankingAccumulator>()
  seedClubRows(relevantCategories, rowsByClub)

  const entryClubMap = buildEntryClubMap(relevantCategories)

  for (const category of relevantCategories) {
    const placements = category.result?.placements ?? []
    for (const placement of placements) {
      const club = entryClubMap.get(placement.entryId)
      if (!club) {
        continue
      }

      const row = rowsByClub.get(club.clubIdentity)
      if (!row) {
        continue
      }

      incrementPlacementCounter(row, placement.placement)
      row.points += getPlacementPoints(placement, options.settings)
    }
  }

  for (const category of relevantCategories) {
    for (const bout of category.boutResults) {
      const winnerClub = bout.winnerEntryId ? entryClubMap.get(bout.winnerEntryId) ?? null : null
      const loserClub = bout.loserEntryId ? entryClubMap.get(bout.loserEntryId) ?? null : null

      const winnerClubIdentity = resolveWinnerClubIdentity({
        winnerEntryId: bout.winnerEntryId,
        loserEntryId: bout.loserEntryId,
        victoryMethod: bout.victoryMethod,
        winnerClubIdentity: winnerClub?.clubIdentity ?? null,
        loserClubIdentity: loserClub?.clubIdentity ?? null,
      })

      if (winnerClubIdentity) {
        const row = rowsByClub.get(winnerClubIdentity)
        if (row) {
          row.wins += 1
        }
      }

      for (const clubIdentity of collectFightClubIdentities({
        winnerEntryId: bout.winnerEntryId,
        loserEntryId: bout.loserEntryId,
        victoryMethod: bout.victoryMethod,
        winnerClubIdentity: winnerClub?.clubIdentity ?? null,
        loserClubIdentity: loserClub?.clubIdentity ?? null,
      })) {
        const row = rowsByClub.get(clubIdentity)
        if (row) {
          row.fights += 1
        }
      }
    }
  }

  const rows = [...rowsByClub.values()].map((row) => ({
    rank: 0,
    clubIdentity: row.clubIdentity,
    clubName: row.clubName,
    city: row.city,
    points: row.points,
    firstPlaces: row.firstPlaces,
    secondPlaces: row.secondPlaces,
    thirdPlaces: row.thirdPlaces,
    wins: row.wins,
    fights: row.fights,
  }))

  return {
    rows: rankTeamRows(rows),
    rankingStatus: computeRankingStatus(relevantCategories),
  }
}
