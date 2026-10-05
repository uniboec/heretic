import type {
  BracketStructure,
  CategoryPlacement,
  CategoryResult,
  OlympicBronzeMode,
} from './core/types'
import { withRoundRobinStandings } from './applyResult/roundRobinStandings'
import {
  countRoundRobinParticipants,
  findMatchById,
  resolveOlympicRoles,
  resolveThreeWayRoles,
} from './resolveBracketRoles'

export type DerivePlacementsOptions = {
  systemId: string
  bronzeMode: OlympicBronzeMode | null
  participantCount?: number
}

export function validatePlacements(
  result: CategoryResult,
  options: DerivePlacementsOptions,
): void {
  const { systemId, bronzeMode, participantCount = 0 } = options
  const placements = result.placements
  const entryIds = placements.map((p) => p.entryId)
  const unique = new Set(entryIds)
  if (unique.size !== entryIds.length) {
    throw new Error('Duplicate entryId in placements')
  }

  if (result.status !== 'complete') return

  const placementNumbers = placements.map((p) => p.placement).sort((a, b) => a - b)

  switch (systemId) {
    case 'champion':
      if (placementNumbers.length !== 1 || placementNumbers[0] !== 1) {
        throw new Error('Champion complete must have exactly placement 1')
      }
      break
    case 'olympic':
      if (bronzeMode === 'TWO') {
        if (
          placementNumbers.length !== 4 ||
          !placementNumbers.every((n, i) => n === [1, 2, 3, 3][i])
        ) {
          throw new Error('Olympic TWO complete must have placements 1, 2, 3, 3')
        }
      } else if (bronzeMode === 'ONE') {
        if (
          placementNumbers.length !== 3 ||
          !placementNumbers.every((n, i) => n === [1, 2, 3][i])
        ) {
          throw new Error('Olympic ONE complete must have placements 1, 2, 3')
        }
      }
      break
    case 'three_way':
    case 'three-way':
      if (
        placementNumbers.length !== 3 ||
        !placementNumbers.every((n, i) => n === [1, 2, 3][i])
      ) {
        throw new Error('Three-way complete must have placements 1, 2, 3')
      }
      break
    case 'round_robin': {
      const n = participantCount ?? 0
      if (n === 0) break
      const expected = n >= 3 ? [1, 2, 3] : [1, 2]
      if (
        placementNumbers.length !== expected.length ||
        !placementNumbers.every((num, i) => num === expected[i])
      ) {
        throw new Error(`Round-robin complete must have placements ${expected.join(', ')}`)
      }
      break
    }
    default:
      break
  }
}

function inProgress(placements: CategoryPlacement[]): CategoryResult {
  return {
    status: 'in_progress',
    placements: placements.map((p) => ({ ...p, provisional: true })),
  }
}

function complete(placements: CategoryPlacement[]): CategoryResult {
  return { status: 'complete', placements }
}

function deriveChampion(structure: BracketStructure): CategoryResult {
  const entryId = structure.champion?.entryId ?? structure.result?.placements[0]?.entryId
  if (!entryId) {
    return { status: 'in_progress', placements: [] }
  }
  return complete([
    { entryId, placement: 1, reason: 'SINGLE_PARTICIPANT' },
  ])
}

function deriveOlympic(
  structure: BracketStructure,
  bronzeMode: OlympicBronzeMode | null,
): CategoryResult {
  const { finalMatch, semifinalMatches, bronzeFight } = resolveOlympicRoles(structure, bronzeMode)
  const provisional: CategoryPlacement[] = []

  if (!finalMatch?.winnerEntryId || !finalMatch.loserEntryId) {
    if (bronzeMode === 'TWO') {
      for (const semi of semifinalMatches) {
        if (semi.loserEntryId) {
          provisional.push({
            entryId: semi.loserEntryId,
            placement: 3,
            reason: 'BRONZE_TWO',
          })
        }
      }
    }
    if (provisional.length > 0) return inProgress(provisional)
    return { status: 'in_progress', placements: [] }
  }

  const placements: CategoryPlacement[] = [
    { entryId: finalMatch.winnerEntryId, placement: 1, reason: 'FINAL_WINNER' },
    { entryId: finalMatch.loserEntryId, placement: 2, reason: 'FINAL_LOSER' },
  ]

  if (bronzeMode === 'TWO') {
    for (const semi of semifinalMatches) {
      if (!semi.loserEntryId) {
        return inProgress(placements)
      }
      placements.push({
        entryId: semi.loserEntryId,
        placement: 3,
        reason: 'BRONZE_TWO',
      })
    }
    return complete(placements)
  }

  if (bronzeMode === 'ONE' && bronzeFight) {
    if (!bronzeFight.winnerEntryId) {
      return inProgress(placements)
    }
    placements.push({
      entryId: bronzeFight.winnerEntryId,
      placement: 3,
      reason: 'BRONZE_WINNER',
    })
    return complete(placements)
  }

  return complete(placements)
}

function deriveThreeWay(structure: BracketStructure): CategoryResult {
  const { finalMatch, bronzeSourceMatchId } = resolveThreeWayRoles(structure)

  if (!finalMatch?.winnerEntryId || !finalMatch.loserEntryId) {
    return { status: 'in_progress', placements: [] }
  }

  const placements: CategoryPlacement[] = [
    { entryId: finalMatch.winnerEntryId, placement: 1, reason: 'FINAL_WINNER' },
    { entryId: finalMatch.loserEntryId, placement: 2, reason: 'FINAL_LOSER' },
  ]

  if (!bronzeSourceMatchId) {
    return inProgress(placements)
  }

  const bronzeSourceMatch = findMatchById(structure, bronzeSourceMatchId)
  if (!bronzeSourceMatch?.loserEntryId) {
    return inProgress(placements)
  }

  placements.push({
    entryId: bronzeSourceMatch.loserEntryId,
    placement: 3,
    reason: 'THREE_WAY_BRONZE',
  })

  return complete(placements)
}

function deriveRoundRobin(structure: BracketStructure, participantCount?: number): CategoryResult {
  const pairs = structure.roundRobinPairs ?? []
  if (pairs.length === 0) {
    return { status: 'in_progress', placements: [] }
  }

  const allComplete = pairs.every((pair) => pair.winnerEntryId)
  const standings = structure.roundRobinStandings ?? []
  const n = participantCount ?? countRoundRobinParticipants(structure)
  const medalCount = n >= 3 ? 3 : 2

  if (!allComplete || standings.length < medalCount) {
    return { status: 'in_progress', placements: [] }
  }

  const placements: CategoryPlacement[] = standings.slice(0, medalCount).map((row, index) => ({
    entryId: row.entryId,
    placement: index + 1,
    reason: 'ROUND_ROBIN_STANDING',
  }))

  return complete(placements)
}

function placementsFingerprint(result: CategoryResult): string {
  return (result.placements ?? [])
    .map((placement) => `${placement.entryId}:${placement.placement}`)
    .sort()
    .join('|')
}

export function storedResultIsValidComplete(
  structure: BracketStructure,
  options: DerivePlacementsOptions,
): boolean {
  const stored = structure.result
  if (stored?.status !== 'complete') return false
  if (!stored.placements?.length) return false
  try {
    validatePlacements(stored, options)
    return true
  } catch {
    return false
  }
}

export function deriveCategoryPlacements(
  structure: BracketStructure,
  options: DerivePlacementsOptions,
): CategoryResult {
  const normalizedSystemId =
    options.systemId === 'three-way' ? 'three_way' : options.systemId

  let result: CategoryResult

  switch (normalizedSystemId) {
    case 'champion':
      result = deriveChampion(structure)
      break
    case 'olympic':
      result = deriveOlympic(structure, options.bronzeMode)
      break
    case 'three_way':
      result = deriveThreeWay(structure)
      break
    case 'round_robin':
      result = deriveRoundRobin(structure, options.participantCount)
      break
    default:
      result = { status: 'in_progress', placements: [] }
  }

  if (process.env.NODE_ENV !== 'production') {
    validatePlacements(result, options)
  }

  return result
}

/** Attach derived result to structure; ensures RR standings are fresh before derive. */
export function structureWithDerivedResult(
  structure: BracketStructure,
  options: DerivePlacementsOptions,
): BracketStructure {
  const withStandings =
    options.systemId === 'round_robin' || options.systemId === 'round-robin'
      ? withRoundRobinStandings(structure)
      : structure

  if (storedResultIsValidComplete(withStandings, options)) {
    const stored = withStandings.result!
    const derived = deriveCategoryPlacements(withStandings, options)
    if (
      derived.status === 'complete' &&
      placementsFingerprint(stored) !== placementsFingerprint(derived)
    ) {
      console.warn(
        '[structureWithDerivedResult] stored/derive podium mismatch; returning stored',
        {
          systemId: options.systemId,
          stored: placementsFingerprint(stored),
          derived: placementsFingerprint(derived),
        },
      )
    }
    return {
      ...withStandings,
      result: stored,
    }
  }

  return {
    ...withStandings,
    result: deriveCategoryPlacements(withStandings, options),
  }
}
