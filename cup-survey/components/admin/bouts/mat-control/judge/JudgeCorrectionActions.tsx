'use client'

import { judgeStyles } from './judgeModeStyles'

export function JudgeCorrectionActions({
  controlsEnabled,
  onApply,
  onCancel,
  showCancel = true,
}: {
  controlsEnabled: boolean
  onApply: () => void
  onCancel?: () => void
  showCancel?: boolean
}) {
  return (
    <div className={judgeStyles.correctionActions}>
      <button
        type="button"
        className={judgeStyles.btnApplyCorrectionPrimary}
        disabled={!controlsEnabled}
        onClick={onApply}
      >
        Применить исправление
      </button>
      {showCancel && onCancel ? (
        <button
          type="button"
          className={judgeStyles.btnCancelCorrectionOutline}
          disabled={!controlsEnabled}
          onClick={onCancel}
        >
          Отменить коррекцию
        </button>
      ) : null}
    </div>
  )
}
