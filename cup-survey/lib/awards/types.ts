import type {
  AwardCeremonyPlacement,
  AwardCeremonyQueue,
  AwardCeremonyStatus,
  AwardPlacementStatus,
  AwardQueueGroup,
  AwardsPageSetting,
} from '@prisma/client'
import type { CategoryPlacement, CategoryResult } from '@/lib/brackets/core/types'

export type AwardsPageSettings = AwardsPageSetting

export type QueueWithPlacements = AwardCeremonyQueue & {
  placements: AwardCeremonyPlacement[]
}

export type CeremonyParticipantInput = {
  entryId: string
  displayName: string
  clubName: string
}

export type CategoryResultInput = {
  categoryKey: string
  result: CategoryResult | null | undefined
  participants: CeremonyParticipantInput[]
}

export type { AwardCeremonyStatus, AwardPlacementStatus, AwardQueueGroup, CategoryPlacement }
