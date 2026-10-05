import type { CornerNextSanctions } from '@/lib/bouts/buildNextSanctions'
import type { Corner } from '@/lib/bouts/mat-control/types'
import type { InternalBoutSide } from '@/lib/bouts/types'
import type { PenaltyLadder, PenaltySanction } from '@/lib/config/fseRules'
import type { TechnicalScoreActionId } from '@/lib/config/technicalScoreActions'

export type JudgeCornerMode = 'prep' | 'live' | 'correction' | 'readonly' | 'summary'

export type JudgeCornerData = {
  corner: Corner
  side: InternalBoutSide
  score: number
  generalSanction: PenaltySanction | null
  outOfBoundsSanction: PenaltySanction | null
  passivitySanction: PenaltySanction | null
  nextSanctions: CornerNextSanctions
  scoreLabel?: string
  scoreContext?: string
  clearAdvantageDifference?: number
}

export type AthleteWaitControlState = {
  isActive: boolean
  totalMs: number
  noShowAvailable: boolean
}

export type AthleteDoctorControlState = {
  isActive: boolean
  totalMs: number
  removalAvailable: boolean
}

export type AthleteEquipmentControlState = {
  isActive: boolean
  totalMs: number
  disqualifyAvailable: boolean
}

export type JudgeCornerActions = {
  onScore: (points: 1 | 2 | 3 | 4, action?: TechnicalScoreActionId) => void
  onPenaltyNext: (intent: 'PENALTY_GENERAL_NEXT' | 'PENALTY_OUT_OF_BOUNDS_NEXT') => void
  onDisqualify: (ladder: PenaltyLadder) => void
  onPassivity: () => void
  onAthleteWait?: () => void
  onAthleteNoShow?: () => void
  onAthleteDoctor?: () => void
  onAthleteDoctorRemoval?: () => void
  onAthleteEquipment?: () => void
  onAthleteEquipmentDisqualify?: () => void
  onClearAdvantage?: () => void
  onOpenOverflow?: () => void
}
