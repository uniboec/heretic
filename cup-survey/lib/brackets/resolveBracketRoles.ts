import type { BracketRoundMatch, BracketStructure, OlympicBronzeMode } from './core/types'

export type OlympicRoles = {
  finalMatch: BracketRoundMatch | null
  semifinalMatches: BracketRoundMatch[]
  bronzeFight: BracketStructure['bronzeSlots'] extends Array<infer T> ? T | null : null
}

export type ThreeWayRoles = {
  finalMatch: BracketRoundMatch | null
  bronzeSourceMatchId: string | null
}

function maxRound(structure: BracketStructure): number {
  return structure.rounds.reduce((max, match) => Math.max(max, match.round), 0)
}

export function resolveOlympicRoles(
  structure: BracketStructure,
  bronzeMode: OlympicBronzeMode | null,
): OlympicRoles {
  const max = maxRound(structure)
  const finalMatch = structure.rounds.find((match) => match.round === max) ?? null
  const semifinalMatches =
    max > 1 ? structure.rounds.filter((match) => match.round === max - 1) : []
  const bronzeFight =
    bronzeMode === 'ONE'
      ? (structure.bronzeSlots?.find((slot) => slot.id === 'bronze-fight') ?? null)
      : null

  return { finalMatch, semifinalMatches, bronzeFight }
}

function resolveThreeWayFinalMatch(structure: BracketStructure): BracketRoundMatch | null {
  const max = maxRound(structure)
  const finalMatchBySources = structure.rounds.find(
    (match) =>
      match.round === max &&
      match.slotSourceA?.outcome === 'winner' &&
      match.slotSourceB?.outcome === 'winner',
  )
  if (finalMatchBySources) return finalMatchBySources

  const matchesAtMaxRound = structure.rounds.filter((match) => match.round === max)
  if (matchesAtMaxRound.length === 1) {
    return matchesAtMaxRound[0] ?? null
  }

  const bout3 = findMatchById(structure, 'bout-3')
  if (bout3?.winnerEntryId && bout3.loserEntryId) {
    return bout3
  }

  const completedFinal = matchesAtMaxRound.find(
    (match) => match.winnerEntryId && match.loserEntryId,
  )
  return completedFinal ?? null
}

export function resolveThreeWayRoles(structure: BracketStructure): ThreeWayRoles {
  const finalMatch = resolveThreeWayFinalMatch(structure)

  const bronzeSource = structure.bronzeSlots?.[0]?.sourceA
  let bronzeSourceMatchId =
    bronzeSource?.outcome === 'loser' ? bronzeSource.matchId : null

  if (!bronzeSourceMatchId) {
    bronzeSourceMatchId = findMatchById(structure, 'bout-2')?.id ?? null
  }

  if (!bronzeSourceMatchId) {
    const bout2 = findMatchById(structure, 'bout-2')
    if (bout2?.winnerEntryId && bout2.loserEntryId) {
      bronzeSourceMatchId = bout2.id
    }
  }

  return { finalMatch, bronzeSourceMatchId }
}

export function findMatchById(
  structure: BracketStructure,
  matchId: string,
): BracketRoundMatch | null {
  return structure.rounds.find((match) => match.id === matchId) ?? null
}

export function countRoundRobinParticipants(structure: BracketStructure): number {
  const ids = new Set<string>()
  for (const pair of structure.roundRobinPairs ?? []) {
    ids.add(pair.entryIdA)
    ids.add(pair.entryIdB)
  }
  return ids.size
}
