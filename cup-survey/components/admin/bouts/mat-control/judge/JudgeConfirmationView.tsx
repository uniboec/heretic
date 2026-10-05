'use client'

import type { MatControlBoutSnapshot } from '@/lib/bouts/matControlSnapshot'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'
import { reduceScoreEvents } from '@/lib/bouts/scoreEngine'
import { JudgeCornerSummary } from './corners/JudgeCornerSummary'
import { JudgeWorkGrid } from './layout/JudgeWorkGrid'
import { JudgeCenterStage } from './layout/JudgeCenterStage'
import { judgeStyles } from './judgeModeStyles'

export function JudgeConfirmationView({
  activeBout,
  snapshot,
  controlsEnabled,
  confirmDisabledReason,
  confirmValidationWarnings,
  showInjuryScoreAck,
  injuryScoreAcknowledged,
  onInjuryScoreAckChange,
  fightClockStarted,
  onConfirm,
  onCancelStoppage,
  onOpenNextBout,
  onEditResult,
}: {
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
}) {
  const { events, execution, decisionPreview } = activeBout
  const mainScore = reduceScoreEvents(events, 'main', execution.attemptNumber).officialScore
  const extraScore = reduceScoreEvents(events, 'extra', execution.attemptNumber).officialScore
  const decidedInExtra = decisionPreview?.decidedInPeriod === 'extra'
  const displayScore = decidedInExtra ? extraScore : mainScore
  const scoreLabel = decidedInExtra ? 'Счёт доп. раунда' : 'Итоговый счёт'
  const scoreContext = decidedInExtra
    ? `Основное время: ${mainScore.red} : ${mainScore.blue}`
    : undefined
  const redEntryId = activeBout.participants.redEntryId
  const blueEntryId = activeBout.participants.blueEntryId
  const redWarnings = redEntryId ? (snapshot.entryWarnings[redEntryId] ?? []) : []
  const blueWarnings = blueEntryId ? (snapshot.entryWarnings[blueEntryId] ?? []) : []
  const redMandateAthleteId = redEntryId ? snapshot.entryAthleteIds[redEntryId] : null
  const blueMandateAthleteId = blueEntryId ? snapshot.entryAthleteIds[blueEntryId] : null

  return (
    <div className={judgeStyles.workArea}>
      <JudgeWorkGrid
        variant="decision"
        red={
          <JudgeCornerSummary
            corner="red"
            side={activeBout.bout.sideA}
            score={displayScore.red}
            scoreLabel={scoreLabel}
            scoreContext={scoreContext}
            verificationWarnings={redWarnings}
            mandateAthleteId={redMandateAthleteId}
          />
        }
        center={
          <JudgeCenterStage
            variant="result"
            activeBout={activeBout}
            snapshot={snapshot}
            controlsEnabled={controlsEnabled}
            confirmDisabledReason={confirmDisabledReason}
            confirmValidationWarnings={confirmValidationWarnings}
            showInjuryScoreAck={showInjuryScoreAck}
            injuryScoreAcknowledged={injuryScoreAcknowledged}
            onInjuryScoreAckChange={onInjuryScoreAckChange}
            fightClockStarted={fightClockStarted}
            onConfirm={onConfirm}
            onCancelStoppage={onCancelStoppage}
            onOpenNextBout={onOpenNextBout}
            onEditResult={onEditResult}
          />
        }
        blue={
          <JudgeCornerSummary
            corner="blue"
            side={activeBout.bout.sideB}
            score={displayScore.blue}
            scoreLabel={scoreLabel}
            scoreContext={scoreContext}
            verificationWarnings={blueWarnings}
            mandateAthleteId={blueMandateAthleteId}
          />
        }
      />
    </div>
  )
}
