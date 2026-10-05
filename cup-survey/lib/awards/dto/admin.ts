import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import type { AwardsPageSettings, QueueWithPlacements } from '../types'
import type { ScheduledCeremonyCategory } from '../schedule/buildCeremonySchedule'
import {
  formatCeremonyEstimatedLabel,
  formatCeremonyTime,
  placementDisplayName,
} from '../schedule/presentation'
import type { RemainingMedalItem, RemainingMedalSummary } from '../remainingMedals'

export type AdminAwardPlacement = {
  id: string
  entryId: string
  placement: number
  placementIndex: number
  displayName: string
  clubName: string
  status: string
  resolvedAt: string | null
  adminComment: string | null
  publicComment: string | null
}

export type AdminAwardCategory = {
  queueId: string
  categoryKey: string
  categoryTitle: string
  status: string
  queueGroup: string
  queueOrder: number
  needsReview: boolean
  conflictReason: string | null
  revision: number
  ceremonySequence: number | null
  estimatedTimeLabel: string
  adminComment: string | null
  publicComment: string | null
  placements: AdminAwardPlacement[]
}

export type AdminAwardsDashboard = {
  settings: {
    publicEnabled: boolean
    ceremonyStartTime: string
    ceremonyDurationMinutes: number
    ceremonyBreakMinutes: number
  }
  queueRevision: number
  queue: AdminAwardCategory[]
  completed: AdminAwardCategory[]
  needsReview: AdminAwardCategory[]
  remainingMedals: {
    summary: RemainingMedalSummary
    items: RemainingMedalItem[]
  }
}

function compareAdminQueueOrder(left: QueueWithPlacements, right: QueueWithPlacements): number {
  if (left.queueGroup !== right.queueGroup) {
    return left.queueGroup === 'NORMAL' ? -1 : 1
  }
  return left.queueOrder - right.queueOrder
}

function mapCategory(
  queue: QueueWithPlacements,
  scheduled?: ScheduledCeremonyCategory,
): AdminAwardCategory {
  return {
    queueId: queue.id,
    categoryKey: queue.categoryKey,
    categoryTitle: getCategoryTitleFromKey(queue.categoryKey),
    status: queue.status,
    queueGroup: queue.queueGroup,
    queueOrder: queue.queueOrder,
    needsReview: queue.needsReview,
    conflictReason: queue.conflictReason,
    revision: queue.revision,
    ceremonySequence: queue.ceremonySequence,
    estimatedTimeLabel: scheduled
      ? formatCeremonyEstimatedLabel(scheduled.timing)
      : '—',
    adminComment: queue.adminComment,
    publicComment: queue.publicComment,
    placements: queue.placements
      .slice()
      .sort((left, right) => {
        if (left.placement !== right.placement) return left.placement - right.placement
        return left.placementIndex - right.placementIndex
      })
      .map((placement) => ({
        id: placement.id,
        entryId: placement.entryId,
        placement: placement.placement,
        placementIndex: placement.placementIndex,
        displayName: placementDisplayName(placement),
        clubName: placement.clubName,
        status: placement.status,
        resolvedAt: placement.resolvedAt ? formatCeremonyTime(placement.resolvedAt.toISOString()) : null,
        adminComment: placement.adminComment,
        publicComment: placement.publicComment,
      })),
  }
}

export function toAdminAwardsDto(input: {
  settings: AwardsPageSettings
  queue: QueueWithPlacements[]
  scheduled: ScheduledCeremonyCategory[]
  remainingMedals: { summary: RemainingMedalSummary; items: RemainingMedalItem[] }
}): AdminAwardsDashboard {
  const scheduleById = new Map(input.scheduled.map((item) => [item.queueId, item]))
  const active = input.queue
    .filter((item) => item.status === 'PENDING' || item.status === 'IN_PROGRESS')
    .sort(compareAdminQueueOrder)
  const completed = input.queue
    .filter((item) => item.status === 'COMPLETED')
    .sort(
      (left, right) => (left.ceremonySequence ?? 0) - (right.ceremonySequence ?? 0),
    )
  const needsReview = input.queue.filter((item) => item.needsReview).sort(compareAdminQueueOrder)

  return {
    settings: {
      publicEnabled: input.settings.publicEnabled,
      ceremonyStartTime: input.settings.ceremonyStartTime,
      ceremonyDurationMinutes: input.settings.ceremonyDurationMinutes,
      ceremonyBreakMinutes: input.settings.ceremonyBreakMinutes,
    },
    queueRevision: input.settings.queueRevision,
    queue: active.map((item) => mapCategory(item, scheduleById.get(item.id))),
    completed: completed.map((item) => mapCategory(item, scheduleById.get(item.id))),
    needsReview: needsReview.map((item) => mapCategory(item, scheduleById.get(item.id))),
    remainingMedals: input.remainingMedals,
  }
}
