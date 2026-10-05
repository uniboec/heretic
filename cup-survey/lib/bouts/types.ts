import type { BracketSlotSource, BracketStructure } from '../brackets/core/types'

export interface BoutCategoryMeta {
  categoryKey: string
  categoryTitle: string
  discipline: string
  storedMatIndex: number | null
  competitionStage: number
}

export interface InternalAthleteSide {
  kind: 'athlete'
  entryId: string
  displayName: string
  clubName: string
  city: string
  publicNumber: number | null
}

export interface InternalHintSide {
  kind: 'hint'
  label: string
  source?: BracketSlotSource
}

export interface InternalByeSide {
  kind: 'bye'
}

export type InternalBoutSide = InternalAthleteSide | InternalHintSide | InternalByeSide

export type BoutSchedulePhase = 'elimination' | 'bronze' | 'final' | 'round_robin'

type InternalBoutBase = {
  id: string
  matchNumber: number
  scheduleDisplayNumber?: string
  isNextStartable?: boolean
  categoryKey: string
  categoryTitle: string
  discipline: string
  storedMatIndex: number | null
  competitionStage: number
  label?: string
  sideA: InternalBoutSide
  sideB: InternalBoutSide
}

export type InternalBout =
  | InternalBoutBase & {
      schedulePhase: 'elimination'
      round: number
      roundsUntilFinal: number
    }
  | InternalBoutBase & {
      schedulePhase: 'final'
      round: number
      roundsUntilFinal?: never
    }
  | InternalBoutBase & {
      schedulePhase: 'round_robin'
      round: number
      roundsUntilFinal?: never
    }
  | InternalBoutBase & {
      schedulePhase: 'bronze'
      round?: never
      roundsUntilFinal?: never
    }

export interface InternalMatGroup {
  matIndex: number
  bouts: InternalBout[]
}

export interface BoutGroupingWarning {
  code: 'STORED_MAT_INDEX_OUT_OF_RANGE' | 'AUTO_ASSIGNMENT_MISSING'
  categoryKey: string
  boutId: string
  storedMatIndex: number
  matCount: number
}

export type { BoutScheduleOverride, BoutScheduleOverrides } from './scheduleOverrides'

export interface GroupedBoutsResult {
  mats: InternalMatGroup[]
  warnings: BoutGroupingWarning[]
}

export interface PublishedBoutCategoryInput extends BoutCategoryMeta {
  structure: BracketStructure
  participantCount: number
}
