'use client'

import type { Corner } from '@/lib/bouts/mat-control/types'
import type { MatControlBoutSnapshot } from '@/lib/bouts/matControlSnapshot'
import type { MandateWarning } from '@/lib/mandate/types'
import { reduceScoreEvents } from '@/lib/bouts/scoreEngine'
import { JudgeCornerSummary } from './corners/JudgeCornerSummary'
import { JudgeWorkGrid } from './layout/JudgeWorkGrid'
import { JudgeCenterStage } from './layout/JudgeCenterStage'
import { judgeStyles } from './judgeModeStyles'

export function JudgeActivityView({
  activeBout,
  entryWarnings = {},
  entryAthleteIds = {},
  controlsEnabled,
  busy,
  onDecide,
  onCorrectExtra,
}: {
  activeBout: MatControlBoutSnapshot
  entryWarnings?: Record<string, MandateWarning[]>
  entryAthleteIds?: Record<string, string>
  controlsEnabled: boolean
  busy: boolean
  onDecide: (corner: Corner) => void | Promise<void>
  onCorrectExtra: () => void
}) {
  const { events, execution } = activeBout
  const attemptNumber = execution.attemptNumber
  const mainScore = reduceScoreEvents(events, 'main', attemptNumber).officialScore
  const extraScore = reduceScoreEvents(events, 'extra', attemptNumber).officialScore
  const scoreContext = `Основное время: ${mainScore.red} : ${mainScore.blue}`
  const redEntryId = activeBout.participants.redEntryId
  const blueEntryId = activeBout.participants.blueEntryId
  const redWarnings = redEntryId ? (entryWarnings[redEntryId] ?? []) : []
  const blueWarnings = blueEntryId ? (entryWarnings[blueEntryId] ?? []) : []
  const redMandateAthleteId = redEntryId ? entryAthleteIds[redEntryId] : null
  const blueMandateAthleteId = blueEntryId ? entryAthleteIds[blueEntryId] : null

  return (
    <div className={judgeStyles.workArea}>
      <JudgeWorkGrid
        variant="decision"
        red={
          <JudgeCornerSummary
            corner="red"
            side={activeBout.bout.sideA}
            score={extraScore.red}
            scoreLabel="Счёт доп. раунда"
            scoreContext={scoreContext}
            verificationWarnings={redWarnings}
            mandateAthleteId={redMandateAthleteId}
          />
        }
        center={
          <JudgeCenterStage
            variant="activity"
            controlsEnabled={controlsEnabled}
            busy={busy}
            onDecide={onDecide}
            onCorrectExtra={onCorrectExtra}
          />
        }
        blue={
          <JudgeCornerSummary
            corner="blue"
            side={activeBout.bout.sideB}
            score={extraScore.blue}
            scoreLabel="Счёт доп. раунда"
            scoreContext={scoreContext}
            verificationWarnings={blueWarnings}
            mandateAthleteId={blueMandateAthleteId}
          />
        }
      />
    </div>
  )
}
