'use client'

import type { BoutPhase } from '@/lib/bouts/mat-control/types'
import type { Corner } from '@/lib/bouts/mat-control/types'
import type { MatControlBoutSnapshot } from '@/lib/bouts/matControlSnapshot'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'
import { JudgeClockCenter } from '../JudgeClockCenter'
import { JudgeCorrectionCenter } from '../JudgeCorrectionCenter'
import { JudgeActivityCenter } from './JudgeActivityCenter'
import { JudgePrepCenter } from './JudgePrepCenter'
import { JudgeResultCenter } from './JudgeResultCenter'

export type JudgeCenterStageProps =
  | {
      variant: 'prep'
      waitCorner: 'red' | 'blue' | null
      waitElapsedMs: number | null
      controlsEnabled: boolean
      onStartBout: () => void
    }
  | {
      variant: 'clock'
      periodRemainingMs: number
      currentPeriod: 'main' | 'extra'
      boutPhase: BoutPhase
      clockRunning: boolean
      controlsEnabled: boolean
      fightTimeEnabled?: boolean
      fightTimeDisabledReason?: string | null
      showFightButton: boolean
      showFinishButton?: boolean
      periodWarning?: boolean
      passivityCorner?: 'red' | 'blue' | null
      passivityElapsedMs?: number
      onFightTime: () => void
      onFinishBout?: () => void
    }
  | {
      variant: 'correction'
      modeTitle: string
      periodRemainingMs: number
      periodLabel: string
      statusLabel: string
      controlsEnabled: boolean
      onApply: () => void
      onCancel?: () => void
      showCancel?: boolean
    }
  | {
      variant: 'activity'
      controlsEnabled: boolean
      busy: boolean
      onDecide: (corner: Corner) => void | Promise<void>
      onCorrectExtra: () => void
    }
  | {
      variant: 'result'
      activeBout: MatControlBoutSnapshot
      snapshot: MatControlSnapshot
      controlsEnabled: boolean
      confirmDisabledReason?: string
      confirmValidationWarnings?: string[]
      showInjuryScoreAck?: boolean
      injuryScoreAcknowledged?: boolean
      onInjuryScoreAckChange?: (value: boolean) => void
      fightClockStarted?: boolean
      onConfirm: () => void
      onCancelStoppage: () => void
      onOpenNextBout: () => void
      onEditResult?: () => void
    }

export function JudgeCenterStage(props: JudgeCenterStageProps) {
  switch (props.variant) {
    case 'prep':
      return (
        <JudgePrepCenter
          waitCorner={props.waitCorner}
          waitElapsedMs={props.waitElapsedMs}
          controlsEnabled={props.controlsEnabled}
          onStartBout={props.onStartBout}
        />
      )
    case 'clock':
      return (
        <JudgeClockCenter
          periodRemainingMs={props.periodRemainingMs}
          currentPeriod={props.currentPeriod}
          boutPhase={props.boutPhase}
          clockRunning={props.clockRunning}
          controlsEnabled={props.controlsEnabled}
          fightTimeEnabled={props.fightTimeEnabled}
          fightTimeDisabledReason={props.fightTimeDisabledReason}
          showFightButton={props.showFightButton}
          showFinishButton={props.showFinishButton}
          periodWarning={props.periodWarning}
          passivityCorner={props.passivityCorner}
          passivityElapsedMs={props.passivityElapsedMs}
          onFightTime={props.onFightTime}
          onFinishBout={props.onFinishBout}
        />
      )
    case 'correction':
      return (
        <JudgeCorrectionCenter
          modeTitle={props.modeTitle}
          periodRemainingMs={props.periodRemainingMs}
          periodLabel={props.periodLabel}
          statusLabel={props.statusLabel}
          controlsEnabled={props.controlsEnabled}
          onApply={props.onApply}
          onCancel={props.onCancel}
          showCancel={props.showCancel}
        />
      )
    case 'activity':
      return (
        <JudgeActivityCenter
          controlsEnabled={props.controlsEnabled}
          busy={props.busy}
          onDecide={props.onDecide}
          onCorrectExtra={props.onCorrectExtra}
        />
      )
    case 'result':
      return (
        <JudgeResultCenter
          activeBout={props.activeBout}
          snapshot={props.snapshot}
          controlsEnabled={props.controlsEnabled}
          confirmDisabledReason={props.confirmDisabledReason}
          confirmValidationWarnings={props.confirmValidationWarnings}
          showInjuryScoreAck={props.showInjuryScoreAck}
          injuryScoreAcknowledged={props.injuryScoreAcknowledged}
          onInjuryScoreAckChange={props.onInjuryScoreAckChange}
          fightClockStarted={props.fightClockStarted}
          onConfirm={props.onConfirm}
          onCancelStoppage={props.onCancelStoppage}
          onOpenNextBout={props.onOpenNextBout}
          onEditResult={props.onEditResult}
        />
      )
    default:
      return null
  }
}
