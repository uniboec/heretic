import type { SportRankId } from '@/lib/config/ranks'

export type EvskAgeBand = 'child' | 'youth' | 'adult'

export type EvskEventLevel = 'regional_cup'

export interface EvskRuleSnapshot {
  eventLevel: EvskEventLevel
  ageBand: EvskAgeBand
  minWins: number
  placementFrom: number
  placementTo: number
  rankId: SportRankId
}

export interface NormQualificationBoutResult {
  boutId: string
  winnerEntryId: string | null
  loserEntryId: string | null
  victoryMethod: string
}

export interface NormQualificationCategorySource {
  categoryKey: string
  discipline: string
  participants: Array<{
    entryId: string
    athleteId: string
    displayName: string
    birthDate: string
    gender: string
  }>
  result: {
    status: string
    placements: Array<{
      entryId: string
      placement: number
    }>
  } | null
  boutResults: NormQualificationBoutResult[]
}

export interface EvaluatedBracketDetail {
  categoryKey: string
  athleteId: string
  discipline: string
  placement: number
  wins: number
  achievedRank: SportRankId | null
  isAgeUp: boolean
  evskAgeBand: EvskAgeBand
  evskRuleSnapshot: EvskRuleSnapshot | null
}

export interface EvaluatedDisciplineResult {
  athleteId: string
  discipline: string
  displayName: string
  achievedNormRank: SportRankId | null
  sourceCategoryKey: string | null
  displayPlacement: number | null
  displayWins: number | null
  matchingCategoryKeys: string[]
  evskRuleSnapshot: EvskRuleSnapshot | null
}

export interface NormQualificationsPublicRow {
  athleteId: string
  athleteName: string
  clubName: string
  city: string
  discipline: string
  disciplineLabel: string
  resultLabel: string
  categoryLabel: string | null
  placement: number | null
  wins: number | null
  achievedNormRank: SportRankId
  matchingBrackets: Array<{
    categoryKey: string
    categoryLabel: string
    placement: number
    wins: number
  }>
}

export interface NormQualificationsResponse {
  available: boolean
  publishedAt: string | null
  disclaimer: string
  rows: NormQualificationsPublicRow[]
}
