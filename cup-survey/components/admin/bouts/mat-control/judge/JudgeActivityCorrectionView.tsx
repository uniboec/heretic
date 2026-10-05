'use client'

import type { MatControlBoutSnapshot } from '@/lib/bouts/matControlSnapshot'
import type { Corner } from '@/lib/bouts/mat-control/types'
import type { PenaltyLadder } from '@/lib/config/fseRules'
import type { TechnicalScoreActionId } from '@/lib/config/technicalScoreActions'
import { reduceScoreEvents } from '@/lib/bouts/scoreEngine'
import { JudgeCorrectionActions } from './JudgeCorrectionActions'
import { JudgeCorrectionBanner } from './JudgeCorrectionBanner'
import { JudgeCornerColumn } from './JudgeCornerColumn'
import { JudgeCorrectionCenterLabel } from './layout/JudgeCorrectionCenterLabel'
import { JudgeWorkGrid } from './layout/JudgeWorkGrid'
import { judgeStyles } from './judgeModeStyles'

export function JudgeActivityCorrectionView({
  activeBout,
  controlsEnabled,
  disabledReason,
  onScore,
  onPenaltyNext,
  onDisqualify,
  onFinish,
  onCancel,
}: {
  activeBout: MatControlBoutSnapshot
  controlsEnabled: boolean
  disabledReason?: string | null
  onScore: (corner: Corner, points: 1 | 2 | 3 | 4, action?: TechnicalScoreActionId) => void
  onPenaltyNext: (intent: 'PENALTY_GENERAL_NEXT' | 'PENALTY_OUT_OF_BOUNDS_NEXT', corner: Corner) => void
  onDisqualify: (corner: Corner, ladder: PenaltyLadder) => void
  onFinish: () => void
  onCancel: () => void
}) {
  const { score, nextSanctions, events, execution } = activeBout
  const attemptNumber = execution.attemptNumber
  const mainScore = reduceScoreEvents(events, 'main', attemptNumber).officialScore
  const extraScore = reduceScoreEvents(events, 'extra', attemptNumber).officialScore
  const scoreContext = `Основное время: ${mainScore.red} : ${mainScore.blue}`

  return (
    <div className={judgeStyles.workArea}>
      <JudgeCorrectionBanner
        title="Коррекция счёта extra"
        subtitle="Исправьте оценки дополнительного раунда. Отдых продолжается."
      />

      <JudgeWorkGrid
        variant="scoring"
        red={
          <JudgeCornerColumn
            corner="red"
            cornerMode="correction"
            side={activeBout.bout.sideA}
            score={extraScore.red}
            scoreContext={scoreContext}
            generalSanction={score.generalDisciplinaryLadder.red}
            outOfBoundsSanction={score.outOfBoundsLadder.red}
            passivitySanction={score.passivityLadder.red}
            nextSanctions={nextSanctions.red}
            controlsEnabled={controlsEnabled}
            disabledReason={disabledReason}
            showScoring
            passivityActive={false}
            onScore={(points, action) => onScore('red', points, action)}
            onPenaltyNext={(intent) => onPenaltyNext(intent, 'red')}
            onDisqualify={(ladder) => onDisqualify('red', ladder)}
            onPassivity={() => {}}
            showPassivity={false}
          />
        }
        center={<JudgeCorrectionCenterLabel label="КОРРЕКЦИЯ доп. раунда" />}
        blue={
          <JudgeCornerColumn
            corner="blue"
            cornerMode="correction"
            side={activeBout.bout.sideB}
            score={extraScore.blue}
            scoreContext={scoreContext}
            generalSanction={score.generalDisciplinaryLadder.blue}
            outOfBoundsSanction={score.outOfBoundsLadder.blue}
            passivitySanction={score.passivityLadder.blue}
            nextSanctions={nextSanctions.blue}
            controlsEnabled={controlsEnabled}
            disabledReason={disabledReason}
            showScoring
            passivityActive={false}
            onScore={(points, action) => onScore('blue', points, action)}
            onPenaltyNext={(intent) => onPenaltyNext(intent, 'blue')}
            onDisqualify={(ladder) => onDisqualify('blue', ladder)}
            onPassivity={() => {}}
            showPassivity={false}
          />
        }
      />

      <JudgeCorrectionActions
        controlsEnabled={controlsEnabled}
        onApply={onFinish}
        onCancel={onCancel}
      />
    </div>
  )
}
