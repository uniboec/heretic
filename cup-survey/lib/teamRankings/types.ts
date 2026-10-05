import type { SoloParticipantPointsMode } from '@prisma/client'
import type { CategoryResult } from '@/lib/brackets/core/types'

export type TeamRankingDisciplineFilter = 'all' | string

export type TeamRankingStatus = 'in_progress' | 'complete'

export type SoloParticipantPointSettings = {
  mode: SoloParticipantPointsMode
  points: number | null
}

export type TeamRankingPointSettings = {
  first: number
  second: number
  third: number
  soloParticipant: SoloParticipantPointSettings
}

export type TeamRankingRow = {
  rank: number
  clubIdentity: string
  clubName: string
  city: string
  points: number
  firstPlaces: number
  secondPlaces: number
  thirdPlaces: number
  wins: number
  fights: number
}

export type TeamRankingDisciplineOption = {
  id: string
  label: string
}

export type TeamRankingsResponse = {
  published: boolean
  publishedAt: string | null
  rankingStatus: TeamRankingStatus
  pointSettings: TeamRankingPointSettings
  disciplines: TeamRankingDisciplineOption[]
  activeDiscipline: TeamRankingDisciplineFilter
  rows: TeamRankingRow[]
}

export type TeamRankingSettings = {
  tournamentScopeId: string
  firstPlacePoints: number
  secondPlacePoints: number
  thirdPlacePoints: number
  soloParticipantPointsMode: SoloParticipantPointsMode
  soloParticipantFirstPlacePoints: number | null
}

export type TeamRankingCategoryParticipant = {
  entryId: string
  clubName: string
  city: string
}

export type TeamRankingBoutResult = {
  boutId: string
  winnerEntryId: string | null
  loserEntryId: string | null
  victoryMethod: string
}

export type TeamRankingCategorySource = {
  categoryKey: string
  discipline: string
  participants: TeamRankingCategoryParticipant[]
  result: CategoryResult | null | undefined
  boutResults: TeamRankingBoutResult[]
}

export type TeamRankingAccumulator = {
  clubIdentity: string
  clubName: string
  city: string
  points: number
  firstPlaces: number
  secondPlaces: number
  thirdPlaces: number
  wins: number
  fights: number
}
