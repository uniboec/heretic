import { describe, expect, it } from 'vitest'

import {
  canSwapCornersForBout,
  getSwapCornersBlockReason,
  shouldShowSwapCornersButton,
} from '../canSwapCorners'

const baseInput = {
  boutPhase: 'scheduled' as const,
  redEntryId: 'red-1',
  blueEntryId: 'blue-1',
}

describe('canSwapCorners', () => {
  it('shows the button when both athletes are assigned', () => {
    expect(shouldShowSwapCornersButton(baseInput)).toBe(true)
    expect(canSwapCornersForBout(baseInput)).toBe(true)
    expect(getSwapCornersBlockReason(baseInput)).toBeNull()
  })

  it('shows the button during live and after the bout ends', () => {
    for (const boutPhase of [
      'live',
      'pending_activity_decision',
      'pending_confirmation',
      'confirmed',
    ] as const) {
      expect(
        shouldShowSwapCornersButton({
          ...baseInput,
          boutPhase,
        }),
      ).toBe(true)
      expect(
        canSwapCornersForBout({
          ...baseInput,
          boutPhase,
        }),
      ).toBe(true)
    }
  })

  it('hides the button without both athletes', () => {
    expect(
      shouldShowSwapCornersButton({
        ...baseInput,
        blueEntryId: null,
      }),
    ).toBe(false)
  })
})
