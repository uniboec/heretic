import type { Corner } from '@/lib/bouts/mat-control/types'
import type { PenaltyLadder } from '@/lib/config/fseRules'

export type DisqualificationReasonOption = {
  ladder: PenaltyLadder
  label: string
  description: string
}

export const DISQUALIFICATION_REASONS: DisqualificationReasonOption[] = [
  {
    ladder: 'GENERAL',
    label: 'За нарушение',
    description: 'Повторное нарушение по общей лестнице штрафов.',
  },
  {
    ladder: 'OUT_OF_BOUNDS',
    label: 'За выход за ковёр',
    description: 'Повторный выход за пределы ковра.',
  },
  {
    ladder: 'PASSIVITY',
    label: 'За пассивность',
    description: 'Повторная пассивность по лестнице пассивности.',
  },
]

export function getDisqualifiableCorners(input: {
  redEntryId?: string | null
  blueEntryId?: string | null
}): Corner[] {
  const corners: Corner[] = []
  if (input.redEntryId) corners.push('red')
  if (input.blueEntryId) corners.push('blue')
  return corners
}

export function disqualificationReasonLabel(ladder: PenaltyLadder): string {
  return DISQUALIFICATION_REASONS.find((reason) => reason.ladder === ladder)?.label ?? ladder
}
