import type { Prisma } from '@prisma/client'
import type { BracketDrawParticipant } from '@prisma/client'
import type { BracketStructure, BracketSlotSource, CategoryResult, OlympicBronzeMode } from '../core/types'
import { withRoundRobinStandings } from './roundRobinStandings'
import { deserializePublishedStructure, serializePublishedStructure } from '../core/snapshot'
import { findDrawParticipant } from './resolveParticipant'
import { structureWithDerivedResult } from '../deriveCategoryPlacements'
import { readCategoryResult } from '../core/readCategoryResult'

function localMatchIdFromBoutId(boutId: string): string {
  const sep = boutId.lastIndexOf('::')
  return sep >= 0 ? boutId.slice(sep + 2) : boutId
}

function resolveEntryIdForSource(
  source: BracketSlotSource,
  completedLocalMatchId: string,
  winnerEntryId: string | null,
  loserEntryId: string | null,
): string | null {
  if (source.matchId !== completedLocalMatchId) return null
  return source.outcome === 'winner' ? winnerEntryId : loserEntryId
}

function fillSlotFromSource(input: {
  source?: BracketSlotSource
  completedLocalMatchId: string
  winnerEntryId: string | null
  loserEntryId: string | null
  participants: BracketDrawParticipant[]
}): {
  participant: ReturnType<typeof findDrawParticipant>
  clearSource: boolean
} {
  if (!input.source) {
    return { participant: null, clearSource: false }
  }
  const entryId = resolveEntryIdForSource(
    input.source,
    input.completedLocalMatchId,
    input.winnerEntryId,
    input.loserEntryId,
  )
  const participant = findDrawParticipant(input.participants, entryId)
  return { participant, clearSource: participant != null }
}

export function patchStructureWithBoutResult(input: {
  structure: BracketStructure
  boutId: string
  winnerEntryId: string | null
  loserEntryId: string | null
  participants: BracketDrawParticipant[]
  systemId: string
  bronzeMode: OlympicBronzeMode | null
  participantCount?: number
}): { structure: BracketStructure; changed: boolean } {
  const localMatchId = localMatchIdFromBoutId(input.boutId)
  let changed = false

  const bronzeSlotIndex = (input.structure.bronzeSlots ?? []).findIndex(
    (slot) => slot.id === localMatchId,
  )
  const isBronzeBout = bronzeSlotIndex >= 0

  const structure: BracketStructure = {
    ...input.structure,
    rounds: input.structure.rounds.map((match) => {
      const next = { ...match }
      if (match.id === localMatchId) {
        next.winnerEntryId = input.winnerEntryId
        next.loserEntryId = input.loserEntryId
        changed = true
      }

      const fillA = fillSlotFromSource({
        source: match.slotSourceA,
        completedLocalMatchId: localMatchId,
        winnerEntryId: input.winnerEntryId,
        loserEntryId: input.loserEntryId,
        participants: input.participants,
      })
      if (fillA.participant) {
        next.participantA = fillA.participant
        next.slotSourceA = undefined
        next.slotHintA = undefined
        changed = true
      }

      const fillB = fillSlotFromSource({
        source: match.slotSourceB,
        completedLocalMatchId: localMatchId,
        winnerEntryId: input.winnerEntryId,
        loserEntryId: input.loserEntryId,
        participants: input.participants,
      })
      if (fillB.participant) {
        next.participantB = fillB.participant
        next.slotSourceB = undefined
        next.slotHintB = undefined
        changed = true
      }
      return next
    }),
    bronzeSlots: (input.structure.bronzeSlots ?? []).map((bronze, index) => {
      const next = { ...bronze }
      if (isBronzeBout && index === bronzeSlotIndex) {
        next.winnerEntryId = input.winnerEntryId
        next.loserEntryId = input.loserEntryId
        changed = true
      }
      const fillA = fillSlotFromSource({
        source: bronze.sourceA,
        completedLocalMatchId: localMatchId,
        winnerEntryId: input.winnerEntryId,
        loserEntryId: input.loserEntryId,
        participants: input.participants,
      })
      if (fillA.participant) {
        next.hintA = fillA.participant.displayName
        next.entryIdA = fillA.participant.entryId
        next.sourceA = undefined
        changed = true
      }
      const fillB = fillSlotFromSource({
        source: bronze.sourceB,
        completedLocalMatchId: localMatchId,
        winnerEntryId: input.winnerEntryId,
        loserEntryId: input.loserEntryId,
        participants: input.participants,
      })
      if (fillB.participant) {
        next.hintB = fillB.participant.displayName
        next.entryIdB = fillB.participant.entryId
        next.sourceB = undefined
        changed = true
      }
      return next
    }),
    roundRobinPairs: (input.structure.roundRobinPairs ?? []).map((pair) => {
      const pairLocalId = `rr-${pair.matchNumber ?? `${pair.entryIdA}-${pair.entryIdB}`}`
      if (pairLocalId !== localMatchId) {
        return pair
      }
      changed = true
      return {
        ...pair,
        winnerEntryId: input.winnerEntryId,
        loserEntryId: input.loserEntryId,
      }
    }),
  }

  const withStandings = withRoundRobinStandings(structure)
  const standingsChanged =
    JSON.stringify(withStandings.roundRobinStandings) !==
    JSON.stringify(input.structure.roundRobinStandings)

  const patched = withStandings
  const withResult = structureWithDerivedResult(patched, {
    systemId: input.systemId,
    bronzeMode: input.bronzeMode,
    participantCount: input.participantCount,
  })

  const resultChanged =
    JSON.stringify(withResult.result) !== JSON.stringify(input.structure.result)

  return {
    structure: withResult,
    changed: changed || standingsChanged || resultChanged,
  }
}

export async function persistPatchedPublishedStructure(input: {
  tx: Prisma.TransactionClient
  drawId: string
  categoryKey: string
  publishedStructureJson: unknown
  boutId: string
  winnerEntryId: string | null
  loserEntryId: string | null
  participants: BracketDrawParticipant[]
  systemId: string
  bronzeMode: OlympicBronzeMode | null
  participantCount?: number
}): Promise<boolean> {
  const snapshot = deserializePublishedStructure(input.publishedStructureJson)
  if (!snapshot) return false

  const previousResult = readCategoryResult(snapshot.structure, input.systemId)

  const { structure, changed } = patchStructureWithBoutResult({
    structure: snapshot.structure,
    boutId: input.boutId,
    winnerEntryId: input.winnerEntryId,
    loserEntryId: input.loserEntryId,
    participants: input.participants,
    systemId: input.systemId,
    bronzeMode: input.bronzeMode,
    participantCount: input.participantCount ?? input.participants.length,
  })

  if (!changed) return false

  const serialized = serializePublishedStructure({
    systemId: snapshot.systemId,
    systemVersion: snapshot.systemVersion,
    structure,
  })

  await input.tx.bracketCategoryDraw.update({
    where: { id: input.drawId },
    data: {
      publishedStructureJson: serialized,
    },
  })

  const { notifyAwardCeremonyFromPublishedStructure } = await import('../../awards/hooks')
  await notifyAwardCeremonyFromPublishedStructure({
    tx: input.tx,
    categoryKey: input.categoryKey,
    publishedStructureJson: serialized,
    participants: input.participants,
    previousResult: previousResult as CategoryResult | null,
    systemId: input.systemId,
  })

  return true
}
