import type { PublishedDrawPair } from '../generation/publishedDraws'
import {
  categoryEligibleForAwardsSchedule,
  categoryRequiresBouts,
} from '../core/categoryRequiresBouts'
import { getEffectiveSystemId } from '../core/formatRules'

export type CategoryPublishabilityInput = {
  status: string
  autoSystemId: string | null
  systemOverride: string | null
  participantCount: number
  compositionStale: boolean
  seedingStale: boolean
  balanceStale: boolean
}

export function isCategoryReadyForPublication(
  category: CategoryPublishabilityInput,
  globalCompositionStale: boolean,
): boolean {
  return (
    category.status === 'ACTIVE' &&
    !category.compositionStale &&
    !category.seedingStale &&
    !category.balanceStale &&
    !globalCompositionStale
  )
}

export function isCategoryReadyForBoutRelease(
  category: CategoryPublishabilityInput,
  globalCompositionStale: boolean,
): boolean {
  return (
    isCategoryReadyForPublication(category, globalCompositionStale) &&
    categoryRequiresBouts({
      status: category.status,
      autoSystemId: category.autoSystemId,
      systemOverride: category.systemOverride,
      participantCount: category.participantCount,
    })
  )
}

export function isCategoryReadyForScheduleRelease(
  category: CategoryPublishabilityInput,
  globalCompositionStale: boolean,
): boolean {
  if (!isCategoryReadyForPublication(category, globalCompositionStale)) {
    return false
  }
  const categoryInput = {
    status: category.status,
    autoSystemId: category.autoSystemId,
    systemOverride: category.systemOverride,
    participantCount: category.participantCount,
  }
  return (
    categoryRequiresBouts(categoryInput) || categoryEligibleForAwardsSchedule(categoryInput)
  )
}

export function resolveVisibilityTargetPairs(input: {
  scope: 'all' | 'category'
  categoryKey?: string
  visible: boolean
  currentPairs: PublishedDrawPair[]
}): PublishedDrawPair[] {
  if (input.scope === 'category') {
    if (!input.categoryKey) {
      throw new Error('categoryKey is required for category scope')
    }
    const pair = input.currentPairs.find((item) => item.draw.categoryKey === input.categoryKey)
    return pair ? [pair] : []
  }

  if (input.visible) {
    return input.currentPairs.filter((pair) => pair.draw.status === 'ACTIVE')
  }

  return input.currentPairs
}

export function pairRequiresBouts(pair: PublishedDrawPair): boolean {
  return categoryRequiresBouts({
    status: pair.draw.status,
    autoSystemId: pair.draw.autoSystemId,
    systemOverride: pair.draw.systemOverride,
    participantCount: pair.draw.participants.length,
  })
}

export { categoryRequiresBouts }
