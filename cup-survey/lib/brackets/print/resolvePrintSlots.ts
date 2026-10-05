import type { BracketRoundMatch, BracketSlotSource, CategoryResult } from '../core/types'
import type { BoutOutcomeDto } from '../buildBoutOutcomes'
import type { BracketExportCategory, BracketExportParticipant } from '../export/types'
import {
  formatAdvanceHintFromMatch,
  formatAdvanceHintFromSource,
} from './formatAdvanceHint'
import { resolveStaleAdvanceHintLabel } from '../scheduleHint'
import type { PrintSlot } from './types'

export type SlotResolveContext = {
  participants: BracketExportParticipant[]
  rounds: BracketRoundMatch[]
  boutOutcomes: Record<string, BoutOutcomeDto>
  result: CategoryResult | null
  categoryKey?: string
  boutsReleased?: boolean
  scheduleDisplayByBoutId?: Map<string, string>
}

function participantMap(participants: BracketExportParticipant[]): Map<string, BracketExportParticipant> {
  return new Map(participants.map((p) => [p.entryId, p]))
}

function formatScore(outcome: BoutOutcomeDto | undefined, entryId: string): string | null {
  if (!outcome?.winnerEntryId) return null
  if (outcome.mainRedScore === 0 && outcome.mainBlueScore === 0) return null
  return outcome.winnerEntryId === entryId
    ? `${outcome.mainRedScore}:${outcome.mainBlueScore}`
    : `${outcome.mainBlueScore}:${outcome.mainRedScore}`
}

function toAthlete(
  participant: BracketExportParticipant,
  score?: string | null,
): PrintSlot {
  return {
    kind: 'ATHLETE',
    entryId: participant.entryId,
    seedPosition: participant.seedPosition,
    name: participant.displayName,
    club: participant.clubName || undefined,
    city: participant.city || undefined,
    score: score ?? null,
  }
}

function findMatch(rounds: BracketRoundMatch[], matchId: string): BracketRoundMatch | undefined {
  return rounds.find((m) => m.id === matchId)
}

function resolveEntryFromFeeder(
  ctx: SlotResolveContext,
  source: BracketSlotSource,
): string | null {
  const feeder = findMatch(ctx.rounds, source.matchId)
  if (!feeder) return null
  const outcome = ctx.boutOutcomes[feeder.id]
  const winner = feeder.winnerEntryId ?? outcome?.winnerEntryId ?? null
  const loser = feeder.loserEntryId ?? outcome?.loserEntryId ?? null
  if (source.outcome === 'winner') return winner
  return loser
}

export function resolveSlotFromParticipant(
  ctx: SlotResolveContext,
  participant: BracketExportParticipant | null,
  matchId: string,
  side: 'A' | 'B',
): PrintSlot | null {
  if (participant) {
    const outcome = ctx.boutOutcomes[matchId]
    return toAthlete(participant, formatScore(outcome, participant.entryId))
  }
  return null
}

function blankAdvanceSlot(input: {
  sourceBoutId: string
  sourceOutcome: 'WINNER' | 'LOSER'
  hintLabel?: string
}): PrintSlot {
  return {
    kind: 'BLANK_ADVANCE',
    sourceBoutId: input.sourceBoutId,
    sourceOutcome: input.sourceOutcome,
    hintLabel: input.hintLabel,
  }
}

export function resolveSlotFromSource(
  ctx: SlotResolveContext,
  source: BracketSlotSource | undefined,
  sideMatchId: string,
): PrintSlot {
  if (!source) {
    return blankAdvanceSlot({ sourceBoutId: sideMatchId, sourceOutcome: 'WINNER' })
  }
  const entryId = resolveEntryFromFeeder(ctx, source)
  if (entryId) {
    const byEntry = participantMap(ctx.participants)
    const athlete = byEntry.get(entryId)
    if (athlete) {
      const feeder = findMatch(ctx.rounds, source.matchId)
      const outcome = feeder ? ctx.boutOutcomes[feeder.id] : undefined
      return toAthlete(athlete, formatScore(outcome, entryId))
    }
  }
  return blankAdvanceSlot({
    sourceBoutId: source.matchId,
    sourceOutcome: source.outcome === 'winner' ? 'WINNER' : 'LOSER',
    hintLabel: formatAdvanceHintFromSource(ctx.rounds, source, {
      categoryKey: ctx.categoryKey,
      released: ctx.boutsReleased === true,
      scheduleDisplayByBoutId: ctx.scheduleDisplayByBoutId,
    }),
  })
}

export function resolveMatchSlot(
  ctx: SlotResolveContext,
  match: BracketRoundMatch,
  side: 'A' | 'B',
): PrintSlot {
  const direct = side === 'A' ? match.participantA : match.participantB
  const fromParticipant = resolveSlotFromParticipant(ctx, direct, match.id, side)
  if (fromParticipant) return fromParticipant

  const source = side === 'A' ? match.slotSourceA : match.slotSourceB
  if (source) return resolveSlotFromSource(ctx, source, match.id)

  const hintLabel = side === 'A' ? match.slotHintA : match.slotHintB
  const resolvedHint =
    hintLabel && ctx.categoryKey
      ? resolveStaleAdvanceHintLabel({
          label: hintLabel,
          categoryKey: ctx.categoryKey,
          released: ctx.boutsReleased === true,
          scheduleDisplayByBoutId: ctx.scheduleDisplayByBoutId,
        })
      : hintLabel
  return blankAdvanceSlot({
    sourceBoutId: match.id,
    sourceOutcome: 'WINNER',
    hintLabel: resolvedHint,
  })
}

export function resolveWinnerAdvance(ctx: SlotResolveContext, match: BracketRoundMatch): PrintSlot {
  const outcome = ctx.boutOutcomes[match.id]
  const winnerId = match.winnerEntryId ?? outcome?.winnerEntryId ?? null
  if (winnerId) {
    const athlete = participantMap(ctx.participants).get(winnerId)
    if (athlete) return toAthlete(athlete, formatScore(outcome, winnerId))
  }
  return blankAdvanceSlot({
    sourceBoutId: match.id,
    sourceOutcome: 'WINNER',
    hintLabel: formatAdvanceHintFromMatch(match, 'WINNER', {
      categoryKey: ctx.categoryKey,
      released: ctx.boutsReleased === true,
      scheduleDisplayByBoutId: ctx.scheduleDisplayByBoutId,
    }),
  })
}

export function resolveLoserAdvance(ctx: SlotResolveContext, match: BracketRoundMatch): PrintSlot {
  const outcome = ctx.boutOutcomes[match.id]
  const loserId = match.loserEntryId ?? outcome?.loserEntryId ?? null
  if (loserId) {
    const athlete = participantMap(ctx.participants).get(loserId)
    if (athlete) return toAthlete(athlete, formatScore(outcome, loserId))
  }
  return blankAdvanceSlot({
    sourceBoutId: match.id,
    sourceOutcome: 'LOSER',
    hintLabel: formatAdvanceHintFromMatch(match, 'LOSER', {
      categoryKey: ctx.categoryKey,
      released: ctx.boutsReleased === true,
      scheduleDisplayByBoutId: ctx.scheduleDisplayByBoutId,
    }),
  })
}

export function resolvePlacementSlot(
  ctx: SlotResolveContext,
  placement: 1 | 2 | 3,
): PrintSlot {
  const row = ctx.result?.placements.find((p) => p.placement === placement)
  if (row) {
    const athlete = participantMap(ctx.participants).get(row.entryId)
    if (athlete) return toAthlete(athlete, null)
  }
  return blankAdvanceSlot({
    sourceBoutId: `placement-${placement}`,
    sourceOutcome: 'WINNER',
  })
}

export function buildSlotContext(
  category: BracketExportCategory,
  options?: {
    boutsReleased?: boolean
    scheduleDisplayByBoutId?: Map<string, string>
  },
): SlotResolveContext {
  const scheduleDisplayByBoutId =
    options?.scheduleDisplayByBoutId ??
    (category.scheduleDisplayByBoutId
      ? new Map(Object.entries(category.scheduleDisplayByBoutId))
      : undefined)

  return {
    participants: category.participants,
    rounds: category.structure.rounds,
    boutOutcomes: category.boutOutcomes,
    result: category.result,
    categoryKey: category.categoryKey,
    boutsReleased: options?.boutsReleased ?? category.boutsReleased,
    scheduleDisplayByBoutId,
  }
}

export function isAthleteSlot(slot: PrintSlot): slot is Extract<PrintSlot, { kind: 'ATHLETE' }> {
  return slot.kind === 'ATHLETE'
}

export function isBlankSlot(slot: PrintSlot): slot is Extract<PrintSlot, { kind: 'BLANK_ADVANCE' }> {
  return slot.kind === 'BLANK_ADVANCE'
}
