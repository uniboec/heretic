import type {
  BracketParticipantInput,
  BracketSlotSource,
  BracketStructure,
} from '../brackets/core/types'
import { getOlympicBronzeBoutNumber } from '../brackets/systems/olympic/matchNumbers'
import type { BoutCategoryMeta, InternalAthleteSide, InternalBout, InternalBoutSide } from './types'

export type BoutParticipantLookup = Map<
  string,
  Pick<InternalAthleteSide, 'displayName' | 'clubName' | 'city' | 'publicNumber'>
>

function athleteSide(participant: BracketParticipantInput): InternalBoutSide {
  return {
    kind: 'athlete',
    entryId: participant.entryId,
    displayName: participant.displayName ?? participant.entryId,
    clubName: participant.clubName ?? '',
    city: participant.city ?? '',
    publicNumber: participant.publicNumber ?? null,
  }
}

function hintSide(label: string, source?: BracketSlotSource): InternalBoutSide {
  return { kind: 'hint', label, source }
}

function byeSide(): InternalBoutSide {
  return { kind: 'bye' }
}

function globalBoutId(categoryKey: string, localId: string): string {
  return `${categoryKey}::${localId}`
}

function sideFromParticipant(
  participant: BracketParticipantInput | null,
  lookup?: BoutParticipantLookup,
): InternalBoutSide {
  if (!participant) return byeSide()
  const meta = lookup?.get(participant.entryId)
  return athleteSide({
    ...participant,
    displayName: participant.displayName ?? meta?.displayName ?? participant.entryId,
    clubName: participant.clubName ?? meta?.clubName ?? '',
    city: participant.city ?? meta?.city ?? '',
    publicNumber: participant.publicNumber ?? meta?.publicNumber ?? null,
  })
}

function sideFromHint(label: string | undefined, source?: BracketSlotSource): InternalBoutSide {
  if (label) return hintSide(label, source)
  return byeSide()
}

function sideFromEntryId(entryId: string, lookup?: BoutParticipantLookup): InternalBoutSide {
  const meta = lookup?.get(entryId)
  return {
    kind: 'athlete',
    entryId,
    displayName: meta?.displayName ?? '',
    clubName: meta?.clubName ?? '',
    city: meta?.city ?? '',
    publicNumber: meta?.publicNumber ?? null,
  }
}

function resolveEntryFromFeeder(
  structure: BracketStructure,
  source: BracketSlotSource,
): string | null {
  const feeder = structure.rounds.find((match) => match.id === source.matchId)
  if (!feeder) return null
  if (source.outcome === 'winner') return feeder.winnerEntryId ?? null
  return feeder.loserEntryId ?? null
}

function findEntryIdByDisplayName(
  hint: string,
  lookup?: BoutParticipantLookup,
): string | null {
  if (!lookup) return null
  for (const [entryId, meta] of lookup) {
    if (meta.displayName === hint) return entryId
  }
  return null
}

function sideFromBronzeSlot(input: {
  entryId?: string
  hint?: string
  source?: BracketSlotSource
  structure: BracketStructure
  participantLookup?: BoutParticipantLookup
}): InternalBoutSide {
  if (input.entryId) {
    return sideFromEntryId(input.entryId, input.participantLookup)
  }

  if (input.source) {
    const entryId = resolveEntryFromFeeder(input.structure, input.source)
    if (entryId) {
      return sideFromEntryId(entryId, input.participantLookup)
    }
  }

  if (input.hint) {
    const entryId = findEntryIdByDisplayName(input.hint, input.participantLookup)
    if (entryId) {
      return sideFromEntryId(entryId, input.participantLookup)
    }
    return sideFromHint(input.hint, input.source)
  }

  return byeSide()
}

function resolveBronzeMatchNumber(structure: BracketStructure): number {
  if (structure.systemId === 'olympic') {
    const firstRoundMatches = structure.rounds.filter((match) => match.round === 1).length
    const bracketSize = firstRoundMatches * 2
    if (bracketSize >= 4) {
      return getOlympicBronzeBoutNumber(bracketSize)
    }
  }

  const maxMainMatchNumber = structure.rounds.reduce(
    (max, match) => Math.max(max, match.matchNumber ?? 0),
    0,
  )
  return maxMainMatchNumber > 0 ? maxMainMatchNumber + 1 : 0
}

function assertExtractionInvariants(bouts: InternalBout[]): void {
  for (const bout of bouts) {
    switch (bout.schedulePhase) {
      case 'elimination':
        if (!Number.isFinite(bout.round) || bout.roundsUntilFinal <= 0) {
          throw new Error(`Invalid elimination bout ${bout.id}: round and roundsUntilFinal > 0 required`)
        }
        break
      case 'final':
      case 'round_robin':
        if (!Number.isFinite(bout.round)) {
          throw new Error(`Invalid ${bout.schedulePhase} bout ${bout.id}: round required`)
        }
        break
      case 'bronze':
        if ('round' in bout && bout.round !== undefined) {
          throw new Error(`Invalid bronze bout ${bout.id}: round must be absent`)
        }
        break
      default:
        throw new Error(`Unknown schedulePhase for bout ${bout.id}`)
    }
  }
}

export function extractBouts(
  structure: BracketStructure,
  category: BoutCategoryMeta,
  participantLookup?: BoutParticipantLookup,
): InternalBout[] {
  const bouts: InternalBout[] = []
  const maxRound =
    structure.rounds.length > 0 ? Math.max(...structure.rounds.map((match) => match.round)) : 0

  for (const match of structure.rounds) {
    const sideA = match.participantA
      ? sideFromParticipant(match.participantA, participantLookup)
      : sideFromHint(match.slotHintA, match.slotSourceA)
    const sideB = match.participantB
      ? sideFromParticipant(match.participantB, participantLookup)
      : sideFromHint(match.slotHintB, match.slotSourceB)

    const base = {
      id: globalBoutId(category.categoryKey, match.id),
      matchNumber: match.matchNumber,
      categoryKey: category.categoryKey,
      categoryTitle: category.categoryTitle,
      discipline: category.discipline,
      storedMatIndex: category.storedMatIndex,
      competitionStage: category.competitionStage,
      label: match.label,
      sideA,
      sideB,
    }

    if (match.round < maxRound) {
      bouts.push({
        ...base,
        schedulePhase: 'elimination',
        round: match.round,
        roundsUntilFinal: maxRound - match.round,
      })
    } else {
      bouts.push({
        ...base,
        schedulePhase: 'final',
        round: match.round,
      })
    }
  }

  for (const pair of structure.roundRobinPairs ?? []) {
    bouts.push({
      id: globalBoutId(
        category.categoryKey,
        `rr-${pair.matchNumber ?? `${pair.entryIdA}-${pair.entryIdB}`}`,
      ),
      matchNumber: pair.matchNumber ?? 0,
      categoryKey: category.categoryKey,
      categoryTitle: category.categoryTitle,
      discipline: category.discipline,
      storedMatIndex: category.storedMatIndex,
      competitionStage: category.competitionStage,
      schedulePhase: 'round_robin',
      round: pair.round,
      sideA: sideFromEntryId(pair.entryIdA, participantLookup),
      sideB: sideFromEntryId(pair.entryIdB, participantLookup),
    })
  }

  for (const bronze of structure.bronzeSlots ?? []) {
    if (!bronze.hintA && !bronze.hintB) continue
    bouts.push({
      id: globalBoutId(category.categoryKey, bronze.id),
      matchNumber: resolveBronzeMatchNumber(structure),
      categoryKey: category.categoryKey,
      categoryTitle: category.categoryTitle,
      discipline: category.discipline,
      storedMatIndex: category.storedMatIndex,
      competitionStage: category.competitionStage,
      schedulePhase: 'bronze',
      label: bronze.label,
      sideA: sideFromBronzeSlot({
        entryId: bronze.entryIdA,
        hint: bronze.hintA,
        source: bronze.sourceA,
        structure,
        participantLookup,
      }),
      sideB: sideFromBronzeSlot({
        entryId: bronze.entryIdB,
        hint: bronze.hintB,
        source: bronze.sourceB,
        structure,
        participantLookup,
      }),
    })
  }

  assertExtractionInvariants(bouts)
  return bouts
}
