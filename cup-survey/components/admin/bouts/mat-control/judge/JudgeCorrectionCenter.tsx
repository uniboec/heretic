'use client'

import { judgeStyles } from './judgeModeStyles'
import { formatJudgeClock } from './judgeUtils'

export function JudgeCorrectionCenter({
  modeTitle,
  periodRemainingMs,
  periodLabel,
  statusLabel,
  controlsEnabled,
  onApply,
  onCancel,
  showCancel = true,
}: {
  modeTitle: string
  periodRemainingMs: number
  periodLabel: string
  statusLabel: string
  controlsEnabled: boolean
  onApply: () => void
  onCancel?: () => void
  showCancel?: boolean
}) {
  return (
    <div className={judgeStyles.clockModule}>
      <div className={judgeStyles.clockStack}>
        <p className={judgeStyles.correctionModeTitle}>{modeTitle}</p>
        <p className={judgeStyles.clock}>{formatJudgeClock(periodRemainingMs)}</p>
        <p className={judgeStyles.clockMeta}>{periodLabel}</p>
        <span className={`mt-0.5 ${judgeStyles.statusChip} ${judgeStyles.statusChipDarkPaused}`}>
          ● {statusLabel}
        </span>
      </div>

      <div className="mt-3 w-full space-y-2">
        <button
          type="button"
          className={judgeStyles.btnApplyCorrection}
          disabled={!controlsEnabled}
          onClick={onApply}
        >
          Применить исправления
        </button>
        {showCancel && onCancel ? (
          <button
            type="button"
            className={judgeStyles.btnCancelCorrection}
            disabled={!controlsEnabled}
            onClick={onCancel}
          >
            Отменить коррекцию
          </button>
        ) : null}
      </div>
    </div>
  )
}
