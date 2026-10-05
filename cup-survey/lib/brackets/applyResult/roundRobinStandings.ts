import type { BracketStructure } from '../core/types'

export type RoundRobinStandingRow = {
  entryId: string
  wins: number
  losses: number
  played: number
}

function ensureRow(
  map: Map<string, RoundRobinStandingRow>,
  entryId: string,
): RoundRobinStandingRow {
  const existing = map.get(entryId)
  if (existing) return existing
  const row = { entryId, wins: 0, losses: 0, played: 0 }
  map.set(entryId, row)
  return row
}

export function computeRoundRobinStandings(
  pairs: BracketStructure['roundRobinPairs'],
): RoundRobinStandingRow[] {
  const rows = new Map<string, RoundRobinStandingRow>()

  for (const pair of pairs ?? []) {
    ensureRow(rows, pair.entryIdA)
    ensureRow(rows, pair.entryIdB)

    if (!pair.winnerEntryId) continue

    const loserEntryId =
      pair.loserEntryId ??
      (pair.winnerEntryId === pair.entryIdA ? pair.entryIdB : pair.entryIdA)

    const winner = ensureRow(rows, pair.winnerEntryId)
    const loser = ensureRow(rows, loserEntryId)
    winner.wins += 1
    winner.played += 1
    loser.losses += 1
    loser.played += 1
  }

  return [...rows.values()].sort((left, right) => {
    if (right.wins !== left.wins) return right.wins - left.wins
    if (left.losses !== right.losses) return left.losses - right.losses
    return left.entryId.localeCompare(right.entryId)
  })
}

export function withRoundRobinStandings(structure: BracketStructure): BracketStructure {
  if (!structure.roundRobinPairs?.length) {
    return structure
  }

  return {
    ...structure,
    roundRobinStandings: computeRoundRobinStandings(structure.roundRobinPairs),
  }
}
