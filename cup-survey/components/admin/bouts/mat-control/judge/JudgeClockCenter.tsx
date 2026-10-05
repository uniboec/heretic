'use client'

import type { BoutPhase } from '@/lib/bouts/mat-control/types'
import { JudgeFightTimeButton } from './JudgeFightTimeButton'
import { judgeStyles } from './judgeModeStyles'
import { formatJudgeClock, formatJudgeElapsedClock } from './judgeUtils'

function buildFooterHint({
  passivityCorner,
  passivityElapsedMs,
  boutPhase,
}: {
  passivityCorner?: 'red' | 'blue' | null
  passivityElapsedMs?: number
  boutPhase: BoutPhase
}): string | null {
  if (passivityCorner) {
    const cornerLabel = passivityCorner === 'red' ? 'красный' : 'синий'
    const elapsed = passivityElapsedMs != null ? formatJudgeElapsedClock(passivityElapsedMs) : ''
    return `Пассивность · ${cornerLabel}${elapsed ? ` · ${elapsed}` : ''}`
  }
  if (boutPhase === 'live') return 'Судейство · основное время'
  if (boutPhase === 'scheduled') return 'Ожидание старта'
  return null
}

export function JudgeClockCenter({
  periodRemainingMs,
  currentPeriod,
  boutPhase,
  clockRunning,
  controlsEnabled,
  fightTimeEnabled,
  fightTimeDisabledReason,
  showFightButton,
  showFinishButton,
  passivityCorner,
  passivityElapsedMs,
  periodWarning,
  onFightTime,
  onFinishBout,
}: {
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
}) {
  const periodLabel = currentPeriod === 'extra' ? 'Доп. раунд' : 'Основное время'

  const statusChip =
    boutPhase === 'scheduled'
      ? { label: 'Подготовка', className: judgeStyles.statusChipDarkIdle }
      : {
          label: 'Идёт',
          className: clockRunning
            ? judgeStyles.statusChipDarkLive
            : judgeStyles.statusChipDarkPaused,
        }

  const footerHint = buildFooterHint({
    passivityCorner,
    passivityElapsedMs,
    boutPhase,
  })
  const canStartFight = fightTimeEnabled ?? controlsEnabled
  const fightDisabledTitle = !canStartFight
    ? (fightTimeDisabledReason ?? 'Управление недоступно')
    : undefined

  const moduleClass = [
    judgeStyles.clockModule,
    clockRunning && !periodWarning ? judgeStyles.clockModuleRunning : '',
    periodWarning ? judgeStyles.clockModuleWarning : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={moduleClass}>
      <div className={judgeStyles.clockStack}>
        <p className={judgeStyles.clock}>{formatJudgeClock(periodRemainingMs)}</p>
        <p className={judgeStyles.clockMeta}>{periodLabel}</p>
        {periodWarning ? (
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--judge-amber)]">≤10 сек</p>
        ) : null}
        <span className={`mt-0.5 ${judgeStyles.statusChip} ${statusChip.className}`}>
          {statusChip.label}
        </span>
      </div>

      {showFightButton ? (
        <div className="mt-2 w-full">
          <JudgeFightTimeButton
            clockRunning={clockRunning}
            disabled={!canStartFight}
            disabledTitle={fightDisabledTitle}
            onClick={onFightTime}
          />
        </div>
      ) : null}

      {showFinishButton && onFinishBout ? (
        <button
          type="button"
          className={`mt-1.5 ${judgeStyles.btnFinishClock}`}
          disabled={!controlsEnabled}
          onClick={onFinishBout}
        >
          Завершить поединок →
        </button>
      ) : null}

      {footerHint ? <p className={judgeStyles.clockFooter}>{footerHint}</p> : null}
    </div>
  )
}
