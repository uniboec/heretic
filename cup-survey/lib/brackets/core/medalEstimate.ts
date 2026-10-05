import { OLYMPIC_BRONZE_MIN_PARTICIPANTS } from '../systemMeta'

export interface CategoryMedalInput {
  status: string
  participantCount: number
  systemId: string | null
  bronzeMode: 'ONE' | 'TWO' | null
}

export interface CategoryMedalBreakdown {
  gold: number
  silver: number
  bronze: number
  included: boolean
}

export interface TournamentMedalEstimate {
  gold: number
  silver: number
  bronze: number
  activeCategories: number
  soloCategories: number
  excludedCategories: number
}

/** Potential podium places for one category (for medal procurement). */
export function estimateCategoryMedals(input: CategoryMedalInput): CategoryMedalBreakdown {
  if (input.participantCount === 1) {
    return { gold: 1, silver: 0, bronze: 0, included: true }
  }

  if (input.status !== 'ACTIVE' || input.participantCount < 2 || !input.systemId) {
    return { gold: 0, silver: 0, bronze: 0, included: false }
  }

  const gold = 1
  const silver = 1
  let bronze = 0

  switch (input.systemId) {
    case 'olympic':
      if (input.participantCount >= OLYMPIC_BRONZE_MIN_PARTICIPANTS) {
        if (input.bronzeMode === 'TWO') bronze = 2
        else if (input.bronzeMode === 'ONE') bronze = 1
      }
      break
    case 'round_robin':
      if (input.participantCount >= 3) bronze = 1
      break
    case 'three_way':
      if (input.participantCount === 3) bronze = 1
      break
    default:
      return { gold: 0, silver: 0, bronze: 0, included: false }
  }

  return { gold, silver, bronze, included: true }
}

export function estimateTournamentMedals(categories: CategoryMedalInput[]): TournamentMedalEstimate {
  let gold = 0
  let silver = 0
  let bronze = 0
  let activeCategories = 0
  let soloCategories = 0
  let excludedCategories = 0

  for (const category of categories) {
    const breakdown = estimateCategoryMedals(category)
    if (!breakdown.included) {
      excludedCategories += 1
      continue
    }
    if (category.participantCount === 1) {
      soloCategories += 1
    } else {
      activeCategories += 1
    }
    gold += breakdown.gold
    silver += breakdown.silver
    bronze += breakdown.bronze
  }

  return { gold, silver, bronze, activeCategories, soloCategories, excludedCategories }
}
