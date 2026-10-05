import type { BracketRoundMatch, BracketSlotSource } from './core/types'
import { formatAdvanceHintFromSource } from './print/formatAdvanceHint'
import { resolveStaleAdvanceHintLabel } from './scheduleHint'

export type BronzeSlotAthleteInput = {
  id: string
  label: string
  hintA?: string
  sourceA?: BracketSlotSource
  entryIdA?: string
}

export function getSemifinalMatches(rounds: BracketRoundMatch[]): BracketRoundMatch[] {
  if (!rounds.length) return []
  const maxRound = rounds.reduce((max, match) => Math.max(max, match.round), 0)
  if (maxRound <= 1) return []
  return rounds
    .filter((match) => match.round === maxRound - 1)
    .sort((left, right) => (left.matchNumber ?? 0) - (right.matchNumber ?? 0))
}

export function bronzeSlotSemiIndex(slotId: string): number | null {
  if (slotId === 'bronze-1') return 0
  if (slotId === 'bronze-2') return 1
  return null
}

function resolveFeederEntryId(
  rounds: BracketRoundMatch[],
  source: BracketSlotSource,
): string | null {
  const feeder = rounds.find((match) => match.id === source.matchId)
  if (!feeder) return null
  return source.outcome === 'winner' ? feeder.winnerEntryId ?? null : feeder.loserEntryId ?? null
}

export function resolveBronzeSlotConditionLabel(
  slot: BronzeSlotAthleteInput,
  options: {
    categoryKey?: string
    scheduleDisplayByBoutId?: Map<string, string>
    rounds?: BracketRoundMatch[]
    boutsReleased?: boolean
  },
): string {
  if (options.categoryKey) {
    const resolved = resolveStaleAdvanceHintLabel({
      label: slot.label,
      categoryKey: options.categoryKey,
      released: true,
      scheduleDisplayByBoutId: options.scheduleDisplayByBoutId,
    })
    if (resolved) return resolved
  }

  if (slot.sourceA && options.rounds && options.categoryKey) {
    return (
      formatAdvanceHintFromSource(options.rounds, slot.sourceA, {
        categoryKey: options.categoryKey,
        released: options.boutsReleased === true,
        scheduleDisplayByBoutId: options.scheduleDisplayByBoutId,
        fallbackHint: slot.label,
      }) ?? slot.label
    )
  }

  return slot.label
}

export function resolveBronzeSingleAthlete(
  slot: BronzeSlotAthleteInput,
  participantsByEntry: Map<string, { displayName: string }>,
  options: {
    rounds?: BracketRoundMatch[]
    categoryKey?: string
    boutsReleased?: boolean
    scheduleDisplayByBoutId?: Map<string, string>
  },
): { label: string; entryId: string | null; pendingHint: boolean } {
  const pendingLabel = resolveBronzeSlotConditionLabel(slot, options)

  if (slot.entryIdA) {
    const label = participantsByEntry.get(slot.entryIdA)?.displayName ?? slot.hintA ?? ''
    if (label) {
      return { label, entryId: slot.entryIdA, pendingHint: false }
    }
  }

  if (slot.hintA) {
    for (const [entryId, participant] of participantsByEntry) {
      if (participant.displayName === slot.hintA) {
        return { label: slot.hintA, entryId, pendingHint: false }
      }
    }
  }

  if (slot.sourceA && options.rounds?.length) {
    const entryId = resolveFeederEntryId(options.rounds, slot.sourceA)
    if (entryId) {
      const label = participantsByEntry.get(entryId)?.displayName ?? entryId
      return { label, entryId, pendingHint: false }
    }
  }

  const semiIndex = bronzeSlotSemiIndex(slot.id)
  if (semiIndex !== null && options.rounds?.length) {
    const semi = getSemifinalMatches(options.rounds)[semiIndex]
    const entryId = semi?.loserEntryId ?? null
    if (entryId) {
      const label = participantsByEntry.get(entryId)?.displayName ?? entryId
      return { label, entryId, pendingHint: false }
    }
  }

  return { label: pendingLabel, entryId: null, pendingHint: Boolean(pendingLabel) }
}
