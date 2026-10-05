'use client'

import { entryIdForCorner } from '@/lib/bouts/assertBoutParticipantCorner'
import type { MatControlBoutSnapshot } from '@/lib/bouts/matControlSnapshot'
import type { MandateWarning } from '@/lib/mandate/types'
import type { Corner } from '@/lib/bouts/mat-control/types'
import type { PenaltyLadder } from '@/lib/config/fseRules'
import type { TechnicalScoreActionId } from '@/lib/config/technicalScoreActions'
import { reduceScoreEvents } from '@/lib/bouts/scoreEngine'
import { JudgeCorrectionActions } from './JudgeCorrectionActions'
import { JudgeCorrectionBanner } from './JudgeCorrectionBanner'
import { JudgeCornerColumn } from './JudgeCornerColumn'
import { JudgeCenterStage } from './layout/JudgeCenterStage'
import { JudgeCorrectionCenterLabel } from './layout/JudgeCorrectionCenterLabel'
import { JudgeWorkGrid } from './layout/JudgeWorkGrid'
import { sideForUiCorner } from './judgeAthlete'
import { judgeStyles } from './judgeModeStyles'

function periodCorrectionBanner(period: 'main' | 'extra'): { title: string; subtitle: string } {
  if (period === 'extra') {
    return {
      title: 'Коррекция счёта extra',
      subtitle: 'Исправьте оценки дополнительного раунда. Таймер заблокирован.',
    }
  }
  return {
    title: 'Коррекция счёта основного времени',
    subtitle: 'Исправьте оценки основного времени. Таймер заблокирован.',
  }
}

function periodCorrectionCenterLabel(period: 'main' | 'extra'): string {
  return period === 'extra' ? 'КОРРЕКЦИЯ доп. раунда' : 'КОРРЕКЦИЯ основного времени'
}

export function JudgeLiveView({
  activeBout,
  controlsEnabled,
  disabledReason,
  fightTimeEnabled,
  fightTimeDisabledReason,
  onScore,
  onPenaltyNext,
  onDisqualify,
  onPassivity,
  onFightTime,
  onFinishBout,
  onOpenCornerOverflow,
  onFinishPeriodCorrection,
  onClearAdvantage,
  onAthleteWait,
  onAthleteNoShow,
  onAthleteDoctor,
  onAthleteDoctorRemoval,
  onAthleteEquipment,
  onAthleteEquipmentDisqualify,
  showAthleteWait = false,
  showAthleteDoctor = false,
  showAthleteEquipment = false,
  entryWarnings = {},
  entryAthleteIds = {},
}: {
  activeBout: MatControlBoutSnapshot
  controlsEnabled: boolean
  disabledReason?: string | null
  fightTimeEnabled?: boolean
  fightTimeDisabledReason?: string | null
  onScore: (corner: Corner, points: 1 | 2 | 3 | 4, action?: TechnicalScoreActionId) => void
  onPenaltyNext: (intent: 'PENALTY_GENERAL_NEXT' | 'PENALTY_OUT_OF_BOUNDS_NEXT', corner: Corner) => void
  onDisqualify: (corner: Corner, ladder: PenaltyLadder) => void
  onPassivity: (corner: Corner) => void
  onFightTime: () => void
  onFinishBout?: () => void
  onOpenCornerOverflow?: (corner: Corner) => void
  onFinishPeriodCorrection?: () => void
  onClearAdvantage?: () => void
  onAthleteWait?: (corner: Corner) => void
  onAthleteNoShow?: (corner: Corner) => void
  onAthleteDoctor?: (corner: Corner) => void
  onAthleteDoctorRemoval?: (corner: Corner) => void
  onAthleteEquipment?: (corner: Corner) => void
  onAthleteEquipmentDisqualify?: (corner: Corner) => void
  showAthleteWait?: boolean
  showAthleteDoctor?: boolean
  showAthleteEquipment?: boolean
  entryWarnings?: Record<string, MandateWarning[]>
  entryAthleteIds?: Record<string, string>
}) {
  const { execution, score, auxiliaryTimers, nextSanctions, hints, events, participants, bout } =
    activeBout
  const redSide = sideForUiCorner('red', bout, participants)
  const blueSide = sideForUiCorner('blue', bout, participants)
  const clockRunning = execution.clockState === 'running'
  const periodCorrection = execution.periodCorrectionMode
  const currentPeriod = execution.currentPeriod
  const clearAdvantage =
    !periodCorrection &&
    hints.clearAdvantageEligible &&
    hints.leadingCorner &&
    hints.scoreDifference != null
      ? { corner: hints.leadingCorner, difference: hints.scoreDifference }
      : null

  const mainScore = reduceScoreEvents(events, 'main', execution.attemptNumber).officialScore
  const periodScore = score.officialScore
  const scoreContext =
    currentPeriod === 'extra' || periodCorrection
      ? `Основное время: ${mainScore.red} : ${mainScore.blue}`
      : undefined

  const periodWarning =
    clockRunning && !periodCorrection && activeBout.periodRemainingMs > 0 && activeBout.periodRemainingMs <= 10_000

  const cornerMode = periodCorrection ? 'correction' : 'live'
  const showFinishButton =
    !periodCorrection &&
    (execution.boutPhase === 'live' || execution.boutPhase === 'scheduled') &&
    Boolean(onFinishBout)

  const center = periodCorrection ? (
    <JudgeCorrectionCenterLabel label={periodCorrectionCenterLabel(currentPeriod)} />
  ) : (
    <JudgeCenterStage
        variant="clock"
        periodRemainingMs={activeBout.periodRemainingMs}
        currentPeriod={currentPeriod}
        boutPhase={execution.boutPhase}
        clockRunning={clockRunning}
        controlsEnabled={controlsEnabled}
        fightTimeEnabled={fightTimeEnabled}
        fightTimeDisabledReason={fightTimeDisabledReason}
        showFightButton
        periodWarning={periodWarning}
        passivityCorner={auxiliaryTimers.passivity?.corner ?? null}
        passivityElapsedMs={auxiliaryTimers.passivity?.elapsedMs}
        showFinishButton={showFinishButton}
        onFightTime={onFightTime}
        onFinishBout={onFinishBout}
      />
    )

  const redEntryId = entryIdForCorner('red', participants)
  const blueEntryId = entryIdForCorner('blue', participants)
  const redWarnings = redEntryId ? (entryWarnings[redEntryId] ?? []) : []
  const blueWarnings = blueEntryId ? (entryWarnings[blueEntryId] ?? []) : []
  const redMandateAthleteId = redEntryId ? entryAthleteIds[redEntryId] : null
  const blueMandateAthleteId = blueEntryId ? entryAthleteIds[blueEntryId] : null

  return (
    <div className={judgeStyles.workArea}>
      {periodCorrection ? (
        <JudgeCorrectionBanner {...periodCorrectionBanner(currentPeriod)} />
      ) : null}

      <div className="relative">
        <JudgeWorkGrid
          variant="scoring"
          red={
            <JudgeCornerColumn
              corner="red"
              side={redSide}
              score={periodScore.red}
              cornerMode={cornerMode}
              verificationWarnings={redWarnings}
              mandateAthleteId={redMandateAthleteId}
              scoreContext={periodCorrection ? scoreContext : undefined}
              generalSanction={score.generalDisciplinaryLadder.red}
              outOfBoundsSanction={score.outOfBoundsLadder.red}
              passivitySanction={score.passivityLadder.red}
              nextSanctions={nextSanctions.red}
              controlsEnabled={controlsEnabled}
              disabledReason={disabledReason}
              showScoring
              showPassivity={!periodCorrection}
              showOverflow={!periodCorrection}
              onOpenOverflow={onOpenCornerOverflow ? () => onOpenCornerOverflow('red') : undefined}
              passivityActive={
                auxiliaryTimers.passivity?.corner === 'red' &&
                auxiliaryTimers.passivity.entryId === entryIdForCorner('red', participants)
              }
              passivityElapsedMs={auxiliaryTimers.passivity?.elapsedMs ?? 0}
              onScore={(points, action) => onScore('red', points, action)}
              onPenaltyNext={(intent) => onPenaltyNext(intent, 'red')}
              onDisqualify={(ladder) => onDisqualify('red', ladder)}
              onPassivity={() => onPassivity('red')}
              clearAdvantageDifference={
                clearAdvantage?.corner === 'red' ? clearAdvantage.difference : undefined
              }
              onClearAdvantage={clearAdvantage?.corner === 'red' ? onClearAdvantage : undefined}
              showAthleteWait={showAthleteWait && !periodCorrection}
              showAthleteDoctor={showAthleteDoctor && !periodCorrection}
              showAthleteEquipment={showAthleteEquipment && !periodCorrection}
              athleteWait={
                auxiliaryTimers.athleteWaits?.red
                  ? {
                      isActive: auxiliaryTimers.athleteWaits.red.isActive,
                      totalMs: auxiliaryTimers.athleteWaits.red.totalMs,
                      noShowAvailable: auxiliaryTimers.athleteWaits.red.noShowAvailable,
                    }
                  : null
              }
              athleteDoctor={
                auxiliaryTimers.athleteDoctorVisits?.red
                  ? {
                      isActive: auxiliaryTimers.athleteDoctorVisits.red.isActive,
                      totalMs: auxiliaryTimers.athleteDoctorVisits.red.totalMs,
                      removalAvailable: auxiliaryTimers.athleteDoctorVisits.red.removalAvailable,
                    }
                  : null
              }
              athleteEquipment={
                auxiliaryTimers.athleteEquipmentCorrections?.red
                  ? {
                      isActive: auxiliaryTimers.athleteEquipmentCorrections.red.isActive,
                      totalMs: auxiliaryTimers.athleteEquipmentCorrections.red.totalMs,
                      disqualifyAvailable:
                        auxiliaryTimers.athleteEquipmentCorrections.red.disqualifyAvailable,
                    }
                  : null
              }
              onAthleteWait={onAthleteWait ? () => onAthleteWait('red') : undefined}
              onAthleteNoShow={onAthleteNoShow ? () => onAthleteNoShow('red') : undefined}
              onAthleteDoctor={onAthleteDoctor ? () => onAthleteDoctor('red') : undefined}
              onAthleteDoctorRemoval={
                onAthleteDoctorRemoval ? () => onAthleteDoctorRemoval('red') : undefined
              }
              onAthleteEquipment={
                onAthleteEquipment ? () => onAthleteEquipment('red') : undefined
              }
              onAthleteEquipmentDisqualify={
                onAthleteEquipmentDisqualify
                  ? () => onAthleteEquipmentDisqualify('red')
                  : undefined
              }
            />
          }
          center={center}
          blue={
            <JudgeCornerColumn
              corner="blue"
              side={blueSide}
              score={periodScore.blue}
              cornerMode={cornerMode}
              verificationWarnings={blueWarnings}
              mandateAthleteId={blueMandateAthleteId}
              scoreContext={periodCorrection ? scoreContext : undefined}
              generalSanction={score.generalDisciplinaryLadder.blue}
              outOfBoundsSanction={score.outOfBoundsLadder.blue}
              passivitySanction={score.passivityLadder.blue}
              nextSanctions={nextSanctions.blue}
              controlsEnabled={controlsEnabled}
              disabledReason={disabledReason}
              showScoring
              showPassivity={!periodCorrection}
              showOverflow={!periodCorrection}
              onOpenOverflow={onOpenCornerOverflow ? () => onOpenCornerOverflow('blue') : undefined}
              passivityActive={
                auxiliaryTimers.passivity?.corner === 'blue' &&
                auxiliaryTimers.passivity.entryId === entryIdForCorner('blue', participants)
              }
              passivityElapsedMs={auxiliaryTimers.passivity?.elapsedMs ?? 0}
              onScore={(points, action) => onScore('blue', points, action)}
              onPenaltyNext={(intent) => onPenaltyNext(intent, 'blue')}
              onDisqualify={(ladder) => onDisqualify('blue', ladder)}
              onPassivity={() => onPassivity('blue')}
              clearAdvantageDifference={
                clearAdvantage?.corner === 'blue' ? clearAdvantage.difference : undefined
              }
              onClearAdvantage={clearAdvantage?.corner === 'blue' ? onClearAdvantage : undefined}
              showAthleteWait={showAthleteWait && !periodCorrection}
              showAthleteDoctor={showAthleteDoctor && !periodCorrection}
              showAthleteEquipment={showAthleteEquipment && !periodCorrection}
              athleteWait={
                auxiliaryTimers.athleteWaits?.blue
                  ? {
                      isActive: auxiliaryTimers.athleteWaits.blue.isActive,
                      totalMs: auxiliaryTimers.athleteWaits.blue.totalMs,
                      noShowAvailable: auxiliaryTimers.athleteWaits.blue.noShowAvailable,
                    }
                  : null
              }
              athleteDoctor={
                auxiliaryTimers.athleteDoctorVisits?.blue
                  ? {
                      isActive: auxiliaryTimers.athleteDoctorVisits.blue.isActive,
                      totalMs: auxiliaryTimers.athleteDoctorVisits.blue.totalMs,
                      removalAvailable: auxiliaryTimers.athleteDoctorVisits.blue.removalAvailable,
                    }
                  : null
              }
              athleteEquipment={
                auxiliaryTimers.athleteEquipmentCorrections?.blue
                  ? {
                      isActive: auxiliaryTimers.athleteEquipmentCorrections.blue.isActive,
                      totalMs: auxiliaryTimers.athleteEquipmentCorrections.blue.totalMs,
                      disqualifyAvailable:
                        auxiliaryTimers.athleteEquipmentCorrections.blue.disqualifyAvailable,
                    }
                  : null
              }
              onAthleteWait={onAthleteWait ? () => onAthleteWait('blue') : undefined}
              onAthleteNoShow={onAthleteNoShow ? () => onAthleteNoShow('blue') : undefined}
              onAthleteDoctor={onAthleteDoctor ? () => onAthleteDoctor('blue') : undefined}
              onAthleteDoctorRemoval={
                onAthleteDoctorRemoval ? () => onAthleteDoctorRemoval('blue') : undefined
              }
              onAthleteEquipment={
                onAthleteEquipment ? () => onAthleteEquipment('blue') : undefined
              }
              onAthleteEquipmentDisqualify={
                onAthleteEquipmentDisqualify
                  ? () => onAthleteEquipmentDisqualify('blue')
                  : undefined
              }
            />
          }
        />
      </div>

      {periodCorrection && onFinishPeriodCorrection ? (
        <JudgeCorrectionActions
          controlsEnabled={controlsEnabled}
          onApply={onFinishPeriodCorrection}
          showCancel={false}
        />
      ) : null}
    </div>
  )
}
