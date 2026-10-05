'use client'

import { useState } from 'react'
import type { CornerNextSanctions } from '@/lib/bouts/buildNextSanctions'
import type { Corner } from '@/lib/bouts/mat-control/types'
import type { InternalBoutSide } from '@/lib/bouts/types'
import type { PenaltyLadder } from '@/lib/config/fseRules'
import { TECHNICAL_SCORE_ACTIONS_BY_POINTS } from '@/lib/config/technicalScoreActions'
import type { TechnicalScoreActionId } from '@/lib/config/technicalScoreActions'
import type {
  AthleteDoctorControlState,
  AthleteEquipmentControlState,
  AthleteWaitControlState,
  JudgeCornerActions,
  JudgeCornerData,
  JudgeCornerMode,
} from './corners/cornerTypes'
import { JudgeDisciplinaryCards } from './JudgeDisciplinaryCards'
import { JudgePenaltyButton } from './JudgePenaltyButton'
import { JudgePenaltyStatus } from './JudgePenaltyStatus'
import { JudgeScoreButton } from './JudgeScoreButton'
import { JudgeTechnicalActionButton } from './JudgeTechnicalActionButton'
import { judgeStyles } from './judgeModeStyles'
import { ATHLETE_EQUIPMENT_TIMEOUT_MS } from '@/lib/bouts/athleteEquipmentCorrection'
import { ATHLETE_DOCTOR_REMOVAL_MS } from '@/lib/bouts/athleteDoctorVisit'
import { ATHLETE_WAIT_NO_SHOW_MS } from '@/lib/bouts/athleteWait'
import { formatJudgeElapsedClock, formatJudgeLimitTimer } from './judgeUtils'
import { sideLabel, sideMeta } from './judgeAthlete'
import { JudgeAthleteVerificationBadges } from './JudgeAthleteVerificationBadges'
import type { MandateWarning } from '@/lib/mandate/types'

type JudgeCornerColumnProps = {
  cornerData?: JudgeCornerData
  cornerActions?: JudgeCornerActions
  corner: Corner
  side: InternalBoutSide
  score: number
  cornerMode?: JudgeCornerMode
  generalSanction: import('@/lib/config/fseRules').PenaltySanction | null
  outOfBoundsSanction: import('@/lib/config/fseRules').PenaltySanction | null
  passivitySanction: import('@/lib/config/fseRules').PenaltySanction | null
  nextSanctions: CornerNextSanctions
  controlsEnabled: boolean
  disabledReason?: string | null
  showScoring: boolean
  passivityActive: boolean
  passivityElapsedMs?: number
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
  showPassivity?: boolean
  showAthleteWait?: boolean
  showAthleteDoctor?: boolean
  showAthleteEquipment?: boolean
  athleteWait?: AthleteWaitControlState | null
  athleteDoctor?: AthleteDoctorControlState | null
  athleteEquipment?: AthleteEquipmentControlState | null
  showOverflow?: boolean
  onOpenOverflow?: () => void
  showKeyHints?: boolean
  clearAdvantageDifference?: number
  onClearAdvantage?: () => void
  scoreLabel?: string
  scoreContext?: string
  verificationWarnings?: MandateWarning[]
  mandateAthleteId?: string | null
}

type CornerOutcomeItem = {
  id: string
  text: string
  buttonLabel: string
  onClick: () => void
}

function CornerOutcomeCallout({
  text,
  buttonLabel,
  controlsEnabled,
  onClick,
}: {
  text: string
  buttonLabel: string
  controlsEnabled: boolean
  onClick: () => void
}) {
  return (
    <div className={judgeStyles.cornerOutcomeCard}>
      <p className={judgeStyles.cornerOutcomeText}>{text}</p>
      <button
        type="button"
        className={judgeStyles.cornerOutcomeBtn}
        disabled={!controlsEnabled}
        onClick={onClick}
      >
        {buttonLabel}
      </button>
    </div>
  )
}

function CornerAuxButton({
  label,
  isActive,
  totalMs,
  hasProgress,
  limitMs,
  className,
  activeClassName,
  disabled,
  title,
  onClick,
}: {
  label: string
  isActive: boolean
  totalMs: number
  hasProgress: boolean
  limitMs: number
  className: string
  activeClassName: string
  disabled?: boolean
  title?: string
  onClick: () => void
}) {
  const timer = formatJudgeLimitTimer(totalMs, limitMs)
  const showTimer = isActive || hasProgress

  return (
    <button
      type="button"
      className={`${className} ${isActive ? activeClassName : ''} ${timer.overLimit ? judgeStyles.btnCornerAuxOverLimit : ''}`}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {showTimer ? (
        <span
          className={`${judgeStyles.btnCornerAuxTitle} text-[12px] leading-tight ${
            timer.overLimit
              ? judgeStyles.btnCornerAuxTitleOverLimit
              : isActive
                ? 'text-[#92400E]'
                : ''
          }`}
        >
          {isActive ? '● ' : ''}
          {label} {timer.ratio}
          {timer.overtime ? (
            <span className={judgeStyles.btnCornerAuxOvertime}> {timer.overtime}</span>
          ) : null}
        </span>
      ) : (
        <span className={judgeStyles.btnCornerAuxTitle}>{label}</span>
      )}
    </button>
  )
}

export function JudgeCornerColumn(props: JudgeCornerColumnProps) {
  const {
    cornerData,
    cornerActions,
    controlsEnabled,
    disabledReason,
    showScoring,
    passivityActive,
    passivityElapsedMs = 0,
    showPassivity = true,
    showAthleteWait = false,
    showAthleteDoctor = false,
    showAthleteEquipment = false,
    athleteWait = null,
    athleteDoctor = null,
    athleteEquipment = null,
    showOverflow = false,
    showKeyHints = false,
    cornerMode = 'live',
  } = props

  const corner = cornerData?.corner ?? props.corner
  const side = cornerData?.side ?? props.side
  const score = cornerData?.score ?? props.score
  const scoreLabel = cornerData?.scoreLabel ?? props.scoreLabel
  const scoreContext = cornerData?.scoreContext ?? props.scoreContext
  const clearAdvantageDifference =
    cornerData?.clearAdvantageDifference ?? props.clearAdvantageDifference
  const generalSanction = cornerData?.generalSanction ?? props.generalSanction
  const outOfBoundsSanction = cornerData?.outOfBoundsSanction ?? props.outOfBoundsSanction
  const passivitySanction = cornerData?.passivitySanction ?? props.passivitySanction
  const nextSanctions = cornerData?.nextSanctions ?? props.nextSanctions

  const onScore = cornerActions?.onScore ?? props.onScore
  const onPenaltyNext = cornerActions?.onPenaltyNext ?? props.onPenaltyNext
  const onDisqualify = cornerActions?.onDisqualify ?? props.onDisqualify
  const onPassivity = cornerActions?.onPassivity ?? props.onPassivity
  const onAthleteWait = cornerActions?.onAthleteWait ?? props.onAthleteWait
  const onAthleteNoShow = cornerActions?.onAthleteNoShow ?? props.onAthleteNoShow
  const onAthleteDoctor = cornerActions?.onAthleteDoctor ?? props.onAthleteDoctor
  const onAthleteDoctorRemoval =
    cornerActions?.onAthleteDoctorRemoval ?? props.onAthleteDoctorRemoval
  const onAthleteEquipment = cornerActions?.onAthleteEquipment ?? props.onAthleteEquipment
  const onAthleteEquipmentDisqualify =
    cornerActions?.onAthleteEquipmentDisqualify ?? props.onAthleteEquipmentDisqualify
  const onClearAdvantage = cornerActions?.onClearAdvantage ?? props.onClearAdvantage
  const onOpenOverflow = cornerActions?.onOpenOverflow ?? props.onOpenOverflow

  const isCompact = cornerMode === 'summary' || cornerMode === 'readonly' || cornerMode === 'prep'
  const isRed = corner === 'red'
  const topAccent = isRed ? judgeStyles.cornerAccentTopRed : judgeStyles.cornerAccentTopBlue
  const leftAccent = isRed ? judgeStyles.cornerAccentLeftRed : judgeStyles.cornerAccentLeftBlue
  const headerClass = isRed ? judgeStyles.cornerHeaderRed : judgeStyles.cornerHeaderBlue
  const badgeClass = isRed ? judgeStyles.cornerBadgeRed : judgeStyles.cornerBadgeBlue

  const displayName = sideLabel(side)
  const affiliation = sideMeta(side)

  const [scoreFlash, setScoreFlash] = useState(false)

  function triggerScoreFlash() {
    setScoreFlash(true)
    window.setTimeout(() => setScoreFlash(false), 450)
  }

  function handleScore(points: 1 | 2 | 3 | 4, action?: TechnicalScoreActionId) {
    triggerScoreFlash()
    onScore(points, action)
  }

  function handlePenalty(ladder: PenaltyLadder) {
    const next = ladder === 'GENERAL' ? nextSanctions.general : nextSanctions.outOfBounds
    if (next === 'DISQUALIFICATION') {
      onDisqualify(ladder)
      return
    }
    onPenaltyNext(ladder === 'GENERAL' ? 'PENALTY_GENERAL_NEXT' : 'PENALTY_OUT_OF_BOUNDS_NEXT')
  }

  const disabledTitle = !controlsEnabled ? (disabledReason ?? 'Управление недоступно') : undefined

  const panelClass =
    cornerMode === 'correction' ? judgeStyles.cornerPanelCorrection : judgeStyles.cornerPanel

  const outcomeItems: CornerOutcomeItem[] = []

  if (clearAdvantageDifference != null && onClearAdvantage) {
    outcomeItems.push({
      id: 'clear-advantage',
      text: `Я.П. · разница ${clearAdvantageDifference}`,
      buttonLabel: 'Завершить по Я.П.',
      onClick: onClearAdvantage,
    })
  }

  if (athleteWait?.isActive && athleteWait.noShowAvailable && onAthleteNoShow) {
    outcomeItems.push({
      id: 'no-show',
      text: 'Время ожидания истекло',
      buttonLabel: 'Неявка',
      onClick: onAthleteNoShow,
    })
  }

  if (athleteEquipment?.disqualifyAvailable && onAthleteEquipmentDisqualify) {
    outcomeItems.push({
      id: 'equipment',
      text: 'Экипировка не исправлена',
      buttonLabel: 'Дисквалификация',
      onClick: onAthleteEquipmentDisqualify,
    })
  }

  if (athleteDoctor?.removalAvailable && onAthleteDoctorRemoval) {
    outcomeItems.push({
      id: 'doctor',
      text: 'Время у врача истекло',
      buttonLabel: 'Снятие врачом',
      onClick: onAthleteDoctorRemoval,
    })
  }

  return (
    <div className={panelClass}>
      <div className={topAccent} aria-hidden />
      <div className={leftAccent} aria-hidden />
      <div className={headerClass}>
        <div className="flex items-center justify-between gap-2">
          <span className={badgeClass}>{isRed ? 'Красный' : 'Синий'}</span>
          {showOverflow && onOpenOverflow && !isCompact ? (
            <button
              type="button"
              className={judgeStyles.cornerOverflowBtn}
              disabled={!controlsEnabled}
              onClick={onOpenOverflow}
              aria-label="Меню угла"
            >
              ⋯
            </button>
          ) : null}
        </div>
        <div className={judgeStyles.cornerAthleteRow}>
          <div className={judgeStyles.cornerAthleteIdentity}>
            <p className={judgeStyles.athleteName}>{displayName}</p>
            {affiliation ? <p className={judgeStyles.athleteClub}>{affiliation}</p> : null}
            <JudgeAthleteVerificationBadges
              warnings={props.verificationWarnings ?? []}
              athleteId={props.mandateAthleteId}
            />
          </div>
          <div className={judgeStyles.cornerDisciplinarySlot}>
            <JudgeDisciplinaryCards
              general={generalSanction}
              outOfBounds={outOfBoundsSanction}
              passivity={passivitySanction}
            />
          </div>
        </div>
      </div>

      <div className={judgeStyles.cornerBody}>
        {!isCompact ? (
          <div className={judgeStyles.cornerScoreRow}>
            <div className={judgeStyles.cornerScoreColumn}>
              {scoreLabel ? <p className={judgeStyles.scorePeriodLabel}>{scoreLabel}</p> : null}
              <p
                className={`${judgeStyles.score} py-1 text-center ${scoreFlash ? judgeStyles.scoreFlash : ''}`}
                aria-live="polite"
                aria-atomic="true"
              >
                {score}
              </p>
              {scoreContext ? <p className={judgeStyles.scoreContextLabel}>{scoreContext}</p> : null}
              <div className={judgeStyles.cornerPenaltyInScore}>
                <JudgePenaltyStatus
                  general={generalSanction}
                  outOfBounds={outOfBoundsSanction}
                  passivity={passivitySanction}
                  nextGeneral={nextSanctions.general}
                  nextOutOfBounds={nextSanctions.outOfBounds}
                  nextPassivity={nextSanctions.passivity}
                />
              </div>
            </div>
            <div
              className={judgeStyles.cornerOutcomeColumn}
              aria-hidden={outcomeItems.length === 0}
            >
              <div className={judgeStyles.cornerOutcomeDock} aria-live="polite">
                {outcomeItems.map((item) => (
                  <CornerOutcomeCallout
                    key={item.id}
                    text={item.text}
                    buttonLabel={item.buttonLabel}
                    controlsEnabled={controlsEnabled}
                    onClick={item.onClick}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {scoreLabel ? <p className={judgeStyles.scorePeriodLabel}>{scoreLabel}</p> : null}
            <p
              className={`${judgeStyles.score} py-1 text-center ${scoreFlash ? judgeStyles.scoreFlash : ''}`}
              aria-live="polite"
              aria-atomic="true"
            >
              {score}
            </p>
            {scoreContext ? <p className={judgeStyles.scoreContextLabel}>{scoreContext}</p> : null}
          </>
        )}

        {showScoring && !isCompact ? (
          <div className="mt-2.5 space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {([1, 2, 3, 4] as const).map((points) => (
                <div key={points} className={judgeStyles.scoreColumn}>
                  <JudgeScoreButton
                    points={points}
                    disabled={!controlsEnabled}
                    disabledTitle={disabledTitle}
                    showKeyHint={showKeyHints}
                    onClick={() => handleScore(points)}
                  />
                  <div className={judgeStyles.technicalActionRow}>
                    {TECHNICAL_SCORE_ACTIONS_BY_POINTS[points].map((action) => (
                      <JudgeTechnicalActionButton
                        key={action.id}
                        action={action}
                        disabled={!controlsEnabled}
                        disabledTitle={disabledTitle}
                        onClick={() => handleScore(points, action.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={judgeStyles.cornerActionGrid}>
              <JudgePenaltyButton
                compact
                title="Нарушение"
                corner={corner}
                nextSanction={nextSanctions.general}
                ladder="GENERAL"
                disabled={!controlsEnabled}
                onClick={() => handlePenalty('GENERAL')}
                variant={nextSanctions.general === 'DISQUALIFICATION' ? 'warning' : 'default'}
              />
              <JudgePenaltyButton
                compact
                title="Выход за ковёр"
                compactTitle="За ковёр"
                corner={corner}
                nextSanction={nextSanctions.outOfBounds}
                ladder="OUT_OF_BOUNDS"
                disabled={!controlsEnabled}
                onClick={() => handlePenalty('OUT_OF_BOUNDS')}
                variant={nextSanctions.outOfBounds === 'DISQUALIFICATION' ? 'warning' : 'default'}
              />
              {showPassivity ? (
                <button
                  type="button"
                  className={`${judgeStyles.btnPassivityCompact} ${passivityActive ? judgeStyles.btnPassivityActive : ''}`}
                  disabled={!controlsEnabled}
                  title={disabledTitle}
                  onClick={onPassivity}
                >
                  <span
                    className={
                      passivityActive
                        ? judgeStyles.btnPassivityTitleActiveCompact
                        : judgeStyles.btnPassivityTitleCompact
                    }
                  >
                    {passivityActive
                      ? `● Пассивность ${formatJudgeElapsedClock(passivityElapsedMs)}`
                      : 'Пассивность'}
                  </span>
                </button>
              ) : (
                <span aria-hidden className="min-w-0" />
              )}
            </div>

            {showAthleteWait || showAthleteEquipment || showAthleteDoctor ? (
              <div className={judgeStyles.cornerActionGrid}>
                {showAthleteWait && onAthleteWait ? (
                  <CornerAuxButton
                    label="Ожидание"
                    isActive={athleteWait?.isActive ?? false}
                    totalMs={athleteWait?.totalMs ?? 0}
                    hasProgress={(athleteWait?.totalMs ?? 0) > 0}
                    limitMs={ATHLETE_WAIT_NO_SHOW_MS}
                    className={`${judgeStyles.btnCornerAux} ${judgeStyles.btnAthleteWaitCompact}`}
                    activeClassName={judgeStyles.btnAthleteWaitActive}
                    disabled={!controlsEnabled}
                    title={disabledTitle}
                    onClick={onAthleteWait}
                  />
                ) : (
                  <span aria-hidden className="min-w-0" />
                )}
                {showAthleteEquipment && onAthleteEquipment ? (
                  <CornerAuxButton
                    label="Экипировка"
                    isActive={athleteEquipment?.isActive ?? false}
                    totalMs={athleteEquipment?.totalMs ?? 0}
                    hasProgress={(athleteEquipment?.totalMs ?? 0) > 0}
                    limitMs={ATHLETE_EQUIPMENT_TIMEOUT_MS}
                    className={`${judgeStyles.btnCornerAux} ${judgeStyles.btnAthleteEquipmentCompact}`}
                    activeClassName={judgeStyles.btnAthleteEquipmentActive}
                    disabled={!controlsEnabled}
                    title={disabledTitle}
                    onClick={onAthleteEquipment}
                  />
                ) : (
                  <span aria-hidden className="min-w-0" />
                )}
                {showAthleteDoctor && onAthleteDoctor ? (
                  <CornerAuxButton
                    label="Врач"
                    isActive={athleteDoctor?.isActive ?? false}
                    totalMs={athleteDoctor?.totalMs ?? 0}
                    hasProgress={(athleteDoctor?.totalMs ?? 0) > 0}
                    limitMs={ATHLETE_DOCTOR_REMOVAL_MS}
                    className={`${judgeStyles.btnCornerAux} ${judgeStyles.btnAthleteDoctorCompact}`}
                    activeClassName={judgeStyles.btnAthleteDoctorActive}
                    disabled={!controlsEnabled}
                    title={disabledTitle}
                    onClick={onAthleteDoctor}
                  />
                ) : (
                  <span aria-hidden className="min-w-0" />
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
