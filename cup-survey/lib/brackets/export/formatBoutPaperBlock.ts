import 'server-only'

import type { BracketRoundMatch } from '../core/types'
import type { BoutOutcomeDto } from '../buildBoutOutcomes'
import { formatBoutLabel } from '../labels'
import { formatAdvanceHintFromSource } from '../print/formatAdvanceHint'
import { resolveBracketMatchLabel } from '../scheduleBoutLabel'
import { PAPER_LINE } from './docxTheme'
import type { BracketExportParticipant } from './types'
import { resolveMatchParticipants } from './formatParticipant'

export type BoutPaperBlockLines = {
  boutLabel: string
  participantLines: string[]
  resultLine: string
  winnerLine: string | null
}

export function formatBoutScore(outcome: BoutOutcomeDto | undefined): string | null {
  if (!outcome) return null
  if (outcome.mainRedScore === 0 && outcome.mainBlueScore === 0 && !outcome.winnerEntryId) {
    return null
  }
  return `${outcome.mainRedScore}:${outcome.mainBlueScore}`
}

export function buildBoutPaperBlock(input: {
  match: BracketRoundMatch
  byEntry: Map<string, BracketExportParticipant>
  boutOutcomes: Record<string, BoutOutcomeDto>
  categoryKey?: string
  rounds?: BracketRoundMatch[]
  boutsReleased?: boolean
  scheduleDisplayByBoutId?: Map<string, string>
}): BoutPaperBlockLines {
  const { match, byEntry, boutOutcomes } = input
  const { participantA, participantB } = resolveMatchParticipants(match, byEntry)
  const boutLabel =
    input.categoryKey != null
      ? resolveBracketMatchLabel({
          categoryKey: input.categoryKey,
          matchId: match.id,
          label: match.label,
          matchNumber: match.matchNumber,
          slot: match.slot,
          scheduleDisplayByBoutId: input.scheduleDisplayByBoutId,
        })
      : match.label ??
        (match.matchNumber != null ? formatBoutLabel(match.matchNumber) : `Бой ${match.slot}`)

  const resolvePendingLabel = (side: 'A' | 'B') => {
    const source = side === 'A' ? match.slotSourceA : match.slotSourceB
    const fallback = side === 'A' ? match.slotHintA : match.slotHintB
    if (!source || !input.categoryKey || !input.rounds) {
      return fallback
    }
    return (
      formatAdvanceHintFromSource(input.rounds, source, {
        categoryKey: input.categoryKey,
        released: input.boutsReleased === true,
        scheduleDisplayByBoutId: input.scheduleDisplayByBoutId,
        fallbackHint: fallback,
      }) ?? fallback
    )
  }

  const outcome = boutOutcomes[match.id]
  const winnerEntryId = match.winnerEntryId ?? outcome?.winnerEntryId ?? null
  const score = formatBoutScore(outcome)

  const formatAthlete = (
    participant: BracketExportParticipant | null,
    pendingLabel?: string,
  ): string => {
    if (!participant) return pendingLabel ?? 'Пропуск'
    const suffix = winnerEntryId && participant.entryId === winnerEntryId ? ' ✓' : ''
    const meta = [participant.clubName?.trim(), participant.city?.trim()].filter(Boolean).join(' · ')
    const seed = participant.seedPosition > 0 ? `[${participant.seedPosition}] ` : ''
    const base = `${seed}${participant.displayName}${meta ? ` · ${meta}` : ''}`
    return `${base}${suffix}`
  }

  const participantLines = [
    formatAthlete(participantA, resolvePendingLabel('A')),
    formatAthlete(participantB, resolvePendingLabel('B')),
  ]

  if (winnerEntryId) {
    return {
      boutLabel,
      participantLines,
      resultLine: score ? `Результат: ${score}` : 'Результат: —',
      winnerLine: null,
    }
  }

  return {
    boutLabel,
    participantLines,
    resultLine: `Результат: ${PAPER_LINE}`,
    winnerLine: `Победитель: ${PAPER_LINE}`,
  }
}

export function boutPaperBlockToPlainText(block: BoutPaperBlockLines): string {
  return [
    block.boutLabel,
    '',
    ...block.participantLines,
    '',
    block.resultLine,
    ...(block.winnerLine ? [block.winnerLine] : []),
  ].join('\n')
}
