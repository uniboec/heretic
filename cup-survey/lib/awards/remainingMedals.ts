import type { AwardCeremonyPlacement, AwardCeremonyQueue } from '@prisma/client'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { formatCeremonyTime, medalEmoji, placementDisplayName } from './schedule/presentation'

export type RemainingMedalSummary = {
  gold: number
  silver: number
  bronze: number
}

export type RemainingMedalItem = {
  placementId: string
  queueId: string
  categoryKey: string
  categoryTitle: string
  displayName: string
  clubName: string
  placement: number
  medal: string
  resolvedAt: string | null
  comment: string | null
}

export function buildRemainingMedals(
  queues: Array<AwardCeremonyQueue & { placements: AwardCeremonyPlacement[] }>,
): { summary: RemainingMedalSummary; items: RemainingMedalItem[] } {
  const items: RemainingMedalItem[] = []

  for (const queue of queues) {
    for (const placement of queue.placements) {
      if (placement.status !== 'NOT_AWARDED') continue
      items.push({
        placementId: placement.id,
        queueId: queue.id,
        categoryKey: queue.categoryKey,
        categoryTitle: getCategoryTitleFromKey(queue.categoryKey),
        displayName: placementDisplayName(placement),
        clubName: placement.clubName,
        placement: placement.placement,
        medal: medalEmoji(placement.placement),
        resolvedAt: placement.resolvedAt ? formatCeremonyTime(placement.resolvedAt.toISOString()) : null,
        comment: placement.publicComment ?? placement.adminComment,
      })
    }
  }

  items.sort((left, right) => {
    const leftTime = left.resolvedAt ?? ''
    const rightTime = right.resolvedAt ?? ''
    if (leftTime !== rightTime) {
      return rightTime.localeCompare(leftTime)
    }
    return left.categoryTitle.localeCompare(right.categoryTitle, 'ru')
  })

  const summary = {
    gold: items.filter((item) => item.placement === 1).length,
    silver: items.filter((item) => item.placement === 2).length,
    bronze: items.filter((item) => item.placement === 3).length,
  }

  return { summary, items }
}
