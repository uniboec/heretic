import type { BoutSchedulePhase, InternalBout } from './types'
import type { BoutDisplayStatus } from './presentation/boutDisplayStatus'

export type BoutTimingStatus = 'upcoming' | 'in_progress' | 'completed'

export type BoutLiveScore = {
  red: number
  blue: number
  periodRemainingMs?: number
  boutPhase?: string
  currentPeriod?: 'main' | 'extra'
}

export type BoutTiming = {
  durationMinutes: number
  scheduledStartAt: string
  scheduledEndAt: string
  estimatedStartAt: string
  estimatedEndAt: string
  actualStartAt?: string
  actualEndAt?: string
  status: BoutTimingStatus
  displayStatus?: BoutDisplayStatus
  delayMinutes: number
  isDelayed: boolean
  liveScore?: BoutLiveScore
}

export type ScheduleExecutionRecord = {
  boutId: string
  actualStartAt: Date | null
  actualEndAt: Date | null
  boutPhase?: string | null
  clockStartedAt?: Date | null
  officialStartedAt?: Date | null
  frozenScheduleFormatted?: string | null
  frozenScheduleMatNumber?: number | null
  frozenSchedulePosition?: number | null
}

export type ScheduledBoutPlan = {
  bout: InternalBout
  matIndex: number
  plannedStartAt: Date
  plannedEndAt: Date
  scheduleWave?: number
}

export type ScheduledBout = {
  id: string
  matchNumber: number
  scheduleDisplayNumber: string
  schedulePosition: number
  matId: string | null
  matNumber: number | null
  isFrozen: boolean
  isInEditableZone: boolean
  isNextStartable: boolean
  matIndex: number
  categoryKey: string
  categoryTitle: string
  discipline: string
  competitionStage: number
  schedulePhase: BoutSchedulePhase
  label?: string
  sideA: unknown
  sideB: unknown
  timing: BoutTiming
  winnerEntryId?: string | null
}

export type StageTimingSummary = {
  stage: number
  notBeforeStartAt?: string
  plannedStartAt: string
  estimatedStartAt: string
  delayMinutes: number
  isDelayed: boolean
  gapAfterPreviousMinutes: number
}

export type PublicMatTiming = {
  matIndex: number
  configuredStartTime: string
  scheduledEndAt: string | null
  estimatedEndAt: string | null
  bouts: ScheduledBout[]
}

export type ScheduledMatsResult = {
  mats: PublicMatTiming[]
  stageSummaries: StageTimingSummary[]
}

export type MatExecutionState = {
  completed: ScheduledBout[]
  inProgress: ScheduledBout | null
  upcoming: ScheduledBout[]
}
