import type { BoutPhase } from './mat-control/types'

const SWAP_CORNERS_PHASES: ReadonlySet<BoutPhase> = new Set([
  'scheduled',
  'live',
  'pending_activity_decision',
  'pending_confirmation',
  'confirmed',
])

export type SwapCornersContext = {
  boutPhase: BoutPhase
  redEntryId?: string | null
  blueEntryId?: string | null
}

export function shouldShowSwapCornersButton(input: SwapCornersContext): boolean {
  return (
    SWAP_CORNERS_PHASES.has(input.boutPhase) &&
    Boolean(input.redEntryId) &&
    Boolean(input.blueEntryId)
  )
}

export function getSwapCornersBlockReason(_input: SwapCornersContext): string | null {
  return null
}

export function canSwapCornersForBout(input: SwapCornersContext): boolean {
  return shouldShowSwapCornersButton(input)
}
