import type { BracketStructure } from '../core/types'
import type { BalanceDelta, DrawBalanceReport } from '../core/seeding/drawBalanceReport'
import type { PublicationStateDto } from '../generation/publicationState'

export interface DraftRef {
  id: string
  version: number
}

export interface AdminCategoryParticipant {
  id: string
  entryId: string
  seedPosition: number
  seedLocked: boolean
  displayName: string
  clubName: string
  city?: string
  clubKey: string | null
  cityKey?: string | null
  strengthTier?: number | null
  publicNumber?: number | null
  isManualMove: boolean
}

export interface AdminCategoryMetadata {
  id: string
  categoryKey: string
  title: string
  status: string
  statusReason: string | null
  autoSystemId: string | null
  systemOverride: string | null
  autoBronzeMode: 'ONE' | 'TWO' | null
  bronzeModeOverride: 'ONE' | 'TWO' | null
  effectiveSystemId: string | null
  effectiveBronzeMode: 'ONE' | 'TWO' | null
  allowedSystemIds: string[]
  formatRuleLabel: string | null
  compositionStale: boolean
  seedingStale: boolean
  balanceStale: boolean
  publicVisible: boolean
  boutsReleased?: boolean
  boutsRepairRequired?: boolean
  matIndex: number | null
  competitionStage: number
  competitionStageEligibility?: Record<number, boolean>
  publicationState: PublicationStateDto
  drawBalanceReport?: DrawBalanceReport | null
  participants: AdminCategoryParticipant[]
  diff?: {
    added: Array<{ entryId: string; displayName: string }>
    removed: Array<{ entryId: string; displayName: string }>
    moved: Array<{ entryId: string; fromCategoryKey: string; toCategoryKey: string }>
  }
}

export interface AdminBracketsDashboardLite {
  settings: {
    publicEnabled: boolean
    includePaid: boolean
    includeUnpaid: boolean
    consolidationEnabled?: boolean
    consolidationPolicy?: import('../consolidation/types').ConsolidationPolicy | null
  }
  draft: DraftRef | null
  published: { id: string; publishedAt: string } | null
  controlsEnabled: boolean
  features?: {
    independentBoutsRelease: boolean
  }
  autoSyncFailures: Array<{
    categoryKey: string
    errorMessage: string | null
    createdAt: string
  }>
  diff: {
    globalCompositionStale: boolean
    registrationDataStale: boolean
    eligibilityCriteriaStale: boolean
  }
  categories: AdminCategoryMetadata[]
  allCategoryKeys: Array<{ key: string; title: string; participantCount: number }>
  configuredCategoryStages: number[]
}

export interface AdminCategoryStructureResponse {
  categoryKey: string
  effectiveSystemId: string | null
  effectiveBronzeMode: 'ONE' | 'TWO' | null
  structure: BracketStructure | null
  result?: BracketStructure['result'] | null
  boutOutcomes?: Record<
    string,
    {
      winnerEntryId: string | null
      loserEntryId: string | null
      victoryMethod: string | null
      mainRedScore: number
      mainBlueScore: number
    }
  >
  isLive?: boolean
  participants: Array<{
    entryId: string
    seedPosition: number
    seedLocked: boolean
    displayName: string
    clubName: string
    city?: string
  }>
}

export interface DraftMutationResponse {
  draft: DraftRef
  category?: AdminCategoryMetadata
  categories?: AdminCategoryMetadata[]
  replaceCategories?: boolean
  warnings?: Array<{ code: string; categoryKey?: string; n?: number }>
  drawBalanceReport?: DrawBalanceReport
  balanceDelta?: BalanceDelta | null
}

export interface PublishMutationResponse {
  draft: DraftRef
  publishedAt: string
}

export interface VisibilityMutationResponse {
  publicationStates: PublicationStateDto[]
  visible: boolean
  affectedCategoryKeys: string[]
}

export interface DraftMutationInput {
  draftId: string
  expectedVersion: number
}

export type ImpactPreviewOperation =
  | 'reset'
  | 'standalone_force_rebuild'
  | 'restore_backup'
  | 'settings_eligibility'
  | 'consolidation'

export interface ImpactPreviewInput {
  operation: ImpactPreviewOperation
  expectedVersion: number
  categoryKeys?: string[]
  backupId?: string
  includePaid?: boolean
  includeUnpaid?: boolean
  policy?: import('../consolidation/types').ConsolidationPolicy
}

export interface ImpactPreviewResponse {
  impactToken: string
  affectedCategoryKeys: string[]
  lockLevels: Record<string, import('../live/guard').CategoryLockLevel>
  totalCategoryCount: number
  liveGenerationId: string
  liveGenerationVersion: number
}

export interface BracketBackupSummary {
  id: string
  label: string | null
  createdAt: string
  categoryCount: number
}

export interface LiveMutationResponse {
  ok: true
  generation: { id: string; version: number }
}

export type ConsolidationPlanPreviewResponse = {
  ok: true
  plan: import('../consolidation/types').ConsolidationPlan
  policy: import('../consolidation/types').ConsolidationPolicy
  entries: import('../consolidation/types').ConsolidationEntrySummary[]
  consolidationPlanToken: string
  impactToken?: string
  impact?: {
    affectedCategoryKeys: string[]
    lockLevels: Record<string, import('../live/guard').CategoryLockLevel>
    totalCategoryCount: number
  }
  draft: DraftRef
}

export type ConsolidationApplyResponse = DraftMutationResponse & {
  ok: true
  movedCount: number
  affectedCategoryKeys: string[]
  planFingerprint: string
}
