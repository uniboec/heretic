import type { BracketParticipantInput } from './types'
import {
  buildDrawBalanceReport,
  summarizeReport,
  type BalanceDelta,
  type DrawBalanceReport,
} from './seeding/drawBalanceReport'

export type { BalanceDelta, DrawBalanceReport }
import { getDefaultDrawPolicy } from './seeding/drawPolicy'

export function buildDrawBalanceReportFromParticipants(
  participants: BracketParticipantInput[],
  searchOptimal: boolean | null = null,
): DrawBalanceReport | null {
  if (participants.length < 2) return null
  return buildDrawBalanceReport({
    assignment: participants.map((participant) => ({
      entryId: participant.entryId,
      strengthTier: participant.strengthTier ?? null,
      clubKey: participant.clubKey ?? null,
      cityKey: participant.cityKey ?? null,
      drawPosition: participant.seedPosition,
      seedLocked: participant.seedLocked,
    })),
    searchOptimal,
    policy: getDefaultDrawPolicy(),
  })
}

export function computeBalanceDelta(
  before: DrawBalanceReport | null,
  after: DrawBalanceReport | null,
): BalanceDelta | null {
  if (!before || !after) return null
  const beforeSummary = summarizeReport(before)
  const afterSummary = summarizeReport(after)
  const lines: string[] = []
  if (beforeSummary.clubLines.join('|') !== afterSummary.clubLines.join('|')) {
    lines.push(
      `Клубы: ${beforeSummary.clubLines[0] ?? '—'} → ${afterSummary.clubLines[0] ?? '—'}`,
    )
  }
  if (before.summary.warnings.length !== after.summary.warnings.length) {
    lines.push(
      `Предупреждения: ${before.summary.warnings.length} → ${after.summary.warnings.length}`,
    )
  }
  return { before: beforeSummary, after: afterSummary, lines }
}
