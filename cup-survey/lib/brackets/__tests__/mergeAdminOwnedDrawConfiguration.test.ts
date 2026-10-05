import { describe, expect, it } from 'vitest'
import {
  mergeAdminOwnedDrawConfiguration,
  resolveMatIndexForCategoryKey,
} from '../generation/mergeAdminOwnedDrawConfiguration'

describe('mergeAdminOwnedDrawConfiguration', () => {
  it('preserves all admin-owned fields from current draft', () => {
    const candidate = {
      systemOverride: null,
      bronzeModeOverride: null,
      drawPolicyId: 'auto-policy',
      drawPolicyVersion: 1,
      matIndex: null,
      competitionStage: 1,
    }
    const currentDraftDraw = {
      systemOverride: 'three_way' as string | null,
      bronzeModeOverride: 'ONE' as const,
      drawPolicyId: 'admin-policy',
      drawPolicyVersion: 9,
      matIndex: null,
      competitionStage: 2,
    }

    const merged = mergeAdminOwnedDrawConfiguration({
      candidate,
      currentDraftDraw,
      activePublishedDraw: {
        systemOverride: null,
        bronzeModeOverride: null,
        drawPolicyId: null,
        drawPolicyVersion: null,
        matIndex: 2,
        competitionStage: 3,
      },
    })

    expect(merged).toEqual({
      systemOverride: 'three_way',
      bronzeModeOverride: 'ONE',
      drawPolicyId: 'admin-policy',
      drawPolicyVersion: 9,
      matIndex: null,
      competitionStage: 2,
    })
    expect(candidate).toEqual({
      systemOverride: null,
      bronzeModeOverride: null,
      drawPolicyId: 'auto-policy',
      drawPolicyVersion: 1,
      matIndex: null,
      competitionStage: 1,
    })
  })

  it('inherits matIndex from published draw when draft category is absent', () => {
    expect(
      resolveMatIndexForCategoryKey({
        currentDraftDraw: undefined,
        activePublishedDraw: { matIndex: 2 },
      }),
    ).toBe(2)
  })

  it('preserves explicit null matIndex on existing draft draw', () => {
    expect(
      resolveMatIndexForCategoryKey({
        currentDraftDraw: { matIndex: null },
        activePublishedDraw: { matIndex: 2 },
      }),
    ).toBeNull()
  })
})
