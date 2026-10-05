export type ConsolidationStepType =
  | 'WEIGHT_UP'
  | 'WEIGHT_DOWN'
  | 'AGE_UP'
  | 'EXPERIENCE_UP'

export type WeightMappingMode = 'SAME_INDEX' | 'CLOSEST_KG'

export type ConsolidationAction = {
  type: ConsolidationStepType
  repeat?: 1 | 2 | 3
  weightMapping?: WeightMappingMode
}

export type ConsolidationStep = {
  enabled: boolean
  actions: ConsolidationAction[]
}

export type ConsolidationPolicy = {
  incompleteThreshold: 1 | 2 | 3
  steps: ConsolidationStep[]
}

export type ConsolidationSkipReason =
  | 'SOURCE_NO_LONGER_INCOMPLETE'
  | 'TARGET_EMPTY'
  | 'TARGET_NOT_FOUND'
  | 'FORMAT_MAX_EXCEEDED'
  | 'GROUP_INELIGIBLE'
  | 'NO_CANDIDATE'

export type ConsolidationTraceHop = {
  hopIndex: number
  stepIndex: number
  entryIds: string[]
  fromCategoryKey: string
  toCategoryKey: string
  actions: ConsolidationAction[]
  step?: ConsolidationStepType
}

export type ConsolidationFinalPlacement = {
  entryId: string
  fromCategoryKey: string
  finalCategoryKey: string
}

export type ConsolidationSkipped = {
  categoryKey: string
  reason: ConsolidationSkipReason
  step?: ConsolidationStepType
  entryIds?: string[]
}

export type ConsolidationPlan = {
  finalPlacements: ConsolidationFinalPlacement[]
  trace: ConsolidationTraceHop[]
  skipped: ConsolidationSkipped[]
  affectedCategoryKeys: string[]
}

export type ConsolidationEntrySummary = {
  entryId: string
  displayName: string
  clubName: string
  city: string
  publicNumber: number | null
}

export type VirtualComposition = Map<string, string[]>

/** @deprecated Legacy parse input only — normalized to `actions[]`. */
export type LegacyConsolidationStepInput = {
  enabled: boolean
  actions?: ConsolidationAction[]
  type?: ConsolidationStepType
  weightMapping?: WeightMappingMode
}

/** Policy input that may contain legacy `{ type, enabled }` steps before normalization. */
export type LegacyConsolidationPolicyInput = {
  incompleteThreshold: 1 | 2 | 3
  steps: LegacyConsolidationStepInput[]
}
