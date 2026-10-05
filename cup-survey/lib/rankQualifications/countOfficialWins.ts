import type { NormQualificationBoutResult } from './types'

/** All official BoutResult wins count; BYE/solo without a result are excluded upstream. */
export function countOfficialWins(
  entryId: string,
  boutResults: readonly NormQualificationBoutResult[],
): number {
  let wins = 0
  for (const result of boutResults) {
    if (result.winnerEntryId === entryId) {
      wins += 1
    }
  }
  return wins
}
