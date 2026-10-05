import type { PenaltySanction } from '../../config/fseRules'
import { formatSanctionShort } from './formatNextSanction'

function formatLadderSteps(current: PenaltySanction | null): string {
  if (!current) return '—'
  return formatSanctionShort(current)
}

export function formatPenaltyLadderStatus(input: {
  general: PenaltySanction | null
  outOfBounds: PenaltySanction | null
  passivity?: PenaltySanction | null
}): { generalLine: string; outOfBoundsLine: string; passivityLine: string } {
  return {
    generalLine: formatLadderSteps(input.general),
    outOfBoundsLine: formatLadderSteps(input.outOfBounds),
    passivityLine: formatLadderSteps(input.passivity ?? null),
  }
}
