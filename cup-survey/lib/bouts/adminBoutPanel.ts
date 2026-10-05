import type { BoutSideData } from '@/components/tournament/BoutCard'
import type { BoutConfirmationSummary } from './formatBoutConfirmation'
import type { BoutPhase } from './mat-control/types'
import type { BoutDisplayStatus } from './presentation/boutDisplayStatus'

export type AdminBoutPanelTimelineEntry = {
  id: string
  headline: string
  subtitle: string
  boutTime: string
}

export type AdminBoutPanelOverview = {
  boutId: string
  matIndex: number
  categoryTitle: string
  matchLabel: string | null
  sideA: BoutSideData
  sideB: BoutSideData
  boutPhase: BoutPhase
  displayStatus: BoutDisplayStatus
  score: {
    red: number
    blue: number
    extraRed: number | null
    extraBlue: number | null
  } | null
  confirmationSummary: BoutConfirmationSummary | null
  timeline: AdminBoutPanelTimelineEntry[]
  canCorrectResult: boolean
  hasEvents: boolean
}
