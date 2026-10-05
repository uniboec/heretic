/** Victory methods without an actual contested bout — do not increment fights. */
export const NON_FIGHT_VICTORY_METHODS = ['NO_SHOW'] as const

export type BoutStatsInput = {
  winnerEntryId: string | null
  loserEntryId: string | null
  victoryMethod: string
  winnerClubIdentity: string | null
  loserClubIdentity: string | null
}

export function countsAsFight(victoryMethod: string): boolean {
  return !NON_FIGHT_VICTORY_METHODS.includes(victoryMethod as (typeof NON_FIGHT_VICTORY_METHODS)[number])
}

export function collectFightClubIdentities(input: BoutStatsInput): string[] {
  if (!countsAsFight(input.victoryMethod)) {
    return []
  }

  const clubs = new Set<string>()
  if (input.winnerClubIdentity) {
    clubs.add(input.winnerClubIdentity)
  }
  if (input.loserClubIdentity) {
    clubs.add(input.loserClubIdentity)
  }
  return [...clubs]
}

export function resolveWinnerClubIdentity(input: BoutStatsInput): string | null {
  return input.winnerClubIdentity
}
