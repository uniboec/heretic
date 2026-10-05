import type { ScheduledCeremonyCategory } from '../schedule/buildCeremonySchedule'
import {
  categoryTitleForKey,
  formatCeremonyEstimatedLabel,
  formatCeremonyTime,
  placementDisplayName,
} from '../schedule/presentation'

export type PublicAwardPlacement = {
  id: string
  entryId: string
  placement: number
  placementIndex: number
  displayName: string
  clubName: string
  status: 'PENDING' | 'AWARDED' | 'NOT_AWARDED'
  publicComment: string | null
}

export type PublicAwardCategory = {
  queueId: string
  categoryKey: string
  categoryTitle: string
  status: 'PENDING' | 'IN_PROGRESS'
  estimatedTimeLabel: string
  placements: PublicAwardPlacement[]
  publicComment: string | null
}

export type PublicCompletedCategory = {
  queueId: string
  categoryKey: string
  categoryTitle: string
  completedAt: string
  completedAtLabel: string
  ceremonySequence: number | null
  placements: PublicAwardPlacement[]
  publicComment: string | null
}

export type PublicAwardsResponse = {
  published: boolean
  ceremonyStartTime: string
  generatedAt: string
  queue: PublicAwardCategory[]
  completed: PublicCompletedCategory[]
}

function mapPlacement(
  placement: ScheduledCeremonyCategory['placements'][number],
  publicComments: Map<string, string | null>,
): PublicAwardPlacement {
  return {
    id: placement.id,
    entryId: placement.entryId,
    placement: placement.placement,
    placementIndex: placement.placementIndex,
    displayName: placementDisplayName(placement),
    clubName: placement.clubName,
    status: placement.status,
    publicComment: publicComments.get(placement.id) ?? null,
  }
}

function sortPlacements(
  placements: ScheduledCeremonyCategory['placements'],
  publicComments: Map<string, string | null>,
): PublicAwardPlacement[] {
  return placements
    .slice()
    .sort((left, right) => {
      if (left.placement !== right.placement) return left.placement - right.placement
      return left.placementIndex - right.placementIndex
    })
    .map((placement) => mapPlacement(placement, publicComments))
}

export function toPublicAwardDto(input: {
  ceremonyStartTime: string
  generatedAt: Date
  scheduled: ScheduledCeremonyCategory[]
  categoryComments: Map<string, string | null>
  placementComments: Map<string, string | null>
  completedTimestamps: Map<string, Date | null>
  ceremonySequences: Map<string, number | null>
}): PublicAwardsResponse {
  const queue = input.scheduled
    .filter((item) => item.status === 'PENDING' || item.status === 'IN_PROGRESS')
    .map((item) => ({
      queueId: item.queueId,
      categoryKey: item.categoryKey,
      categoryTitle: categoryTitleForKey(item.categoryKey),
      status: item.status as 'PENDING' | 'IN_PROGRESS',
      estimatedTimeLabel: formatCeremonyEstimatedLabel(item.timing),
      publicComment: input.categoryComments.get(item.queueId) ?? null,
      placements: sortPlacements(item.placements, input.placementComments),
    }))

  const completed = input.scheduled
    .filter((item) => item.status === 'COMPLETED')
    .map((item) => {
      const completedAt = input.completedTimestamps.get(item.queueId)
      const completedAtIso = completedAt?.toISOString() ?? ''
      return {
        queueId: item.queueId,
        categoryKey: item.categoryKey,
        categoryTitle: categoryTitleForKey(item.categoryKey),
        completedAt: completedAtIso,
        completedAtLabel: completedAt ? formatCeremonyTime(completedAtIso) : '—',
        ceremonySequence: input.ceremonySequences.get(item.queueId) ?? null,
        publicComment: input.categoryComments.get(item.queueId) ?? null,
        placements: sortPlacements(item.placements, input.placementComments),
      }
    })
    .sort((left, right) => {
      const leftTime = left.completedAt ? Date.parse(left.completedAt) : 0
      const rightTime = right.completedAt ? Date.parse(right.completedAt) : 0
      if (leftTime !== rightTime) return rightTime - leftTime
      const leftSeq = left.ceremonySequence ?? 0
      const rightSeq = right.ceremonySequence ?? 0
      if (leftSeq !== rightSeq) return rightSeq - leftSeq
      return left.queueId.localeCompare(right.queueId)
    })

  return {
    published: true,
    ceremonyStartTime: input.ceremonyStartTime,
    generatedAt: input.generatedAt.toISOString(),
    queue,
    completed,
  }
}
