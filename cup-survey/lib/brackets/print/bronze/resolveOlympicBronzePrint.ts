import type { OlympicBronzeMode } from '../../core/types'
import type { BracketExportCategory } from '../../export/types'
import type { PrintBronzeSection, PrintMatchNode, PrintSlot } from '../types'
import {
  buildSlotContext,
  resolveLoserAdvance,
  resolveMatchSlot,
  resolveWinnerAdvance,
} from '../resolvePrintSlots'
import {
  PRINT_MATCH_GAP,
  PRINT_MATCH_ROW_HEIGHT,
  PRINT_MATCH_WIDTH,
} from '../printTheme'

function findSemifinalMatches(category: BracketExportCategory) {
  const maxRound = category.structure.rounds.reduce((max, m) => Math.max(max, m.round), 1)
  const semifinalRound = maxRound - 1
  return category.structure.rounds
    .filter((m) => m.round === semifinalRound)
    .sort((a, b) => a.slot - b.slot)
}

function findBronzeMatch(category: BracketExportCategory) {
  const bronzeSlot = category.structure.bronzeSlots?.find((s) => s.sourceA && s.sourceB)
  if (!bronzeSlot) return null
  const boutNumber = category.structure.rounds.reduce((max, m) => Math.max(max, m.matchNumber ?? 0), 0) + 1
  return { bronzeSlot, boutNumber }
}

export function resolveOlympicBronzePrint(
  category: BracketExportCategory,
  bronzeMode: OlympicBronzeMode | null,
  baseY: number,
): PrintBronzeSection {
  if (!bronzeMode || bronzeMode === ('NONE' as never)) {
    return { mode: 'NONE' }
  }

  const ctx = buildSlotContext(category)
  const semifinals = findSemifinalMatches(category)

  if (bronzeMode === 'TWO') {
    const blank = (boutId: string): PrintSlot => ({
      kind: 'BLANK_ADVANCE',
      sourceBoutId: boutId,
      sourceOutcome: 'LOSER',
    })
    return {
      mode: 'TWO',
      slotA: semifinals[0] ? resolveLoserAdvance(ctx, semifinals[0]) : blank('sf-1'),
      slotB: semifinals[1] ? resolveLoserAdvance(ctx, semifinals[1]) : blank('sf-2'),
      y: baseY,
    }
  }

  const bronzeInfo = findBronzeMatch(category)
  const bronzeSlot = category.structure.bronzeSlots?.[0]
  const matchHeight = PRINT_MATCH_ROW_HEIGHT * 2 + PRINT_MATCH_GAP + 20
  const pseudoMatch = {
    id: bronzeSlot?.id ?? 'bronze-fight',
    round: 0,
    slot: 1,
    matchNumber: bronzeInfo?.boutNumber ?? 0,
    participantA: null,
    participantB: null,
    slotSourceA: bronzeSlot?.sourceA,
    slotSourceB: bronzeSlot?.sourceB,
  }

  const match: PrintMatchNode = {
    id: pseudoMatch.id,
    boutNumber: pseudoMatch.matchNumber || null,
    roundLabel: 'БРОНЗА',
    slotA: resolveMatchSlot(ctx, pseudoMatch, 'A'),
    slotB: resolveMatchSlot(ctx, pseudoMatch, 'B'),
    advanceWinner: resolveWinnerAdvance(ctx, pseudoMatch),
    x: 40,
    y: baseY,
    width: PRINT_MATCH_WIDTH,
    height: matchHeight,
  }

  return { mode: 'ONE', match }
}

export function effectiveBronzeMode(category: BracketExportCategory): OlympicBronzeMode | null {
  return category.effectiveBronzeMode ?? null
}
