'use client'

import type { Corner } from '@/lib/bouts/mat-control/types'
import { judgeStyles } from '../judgeModeStyles'

export function JudgeActivityCenter({
  controlsEnabled,
  busy,
  onDecide,
  onCorrectExtra,
}: {
  controlsEnabled: boolean
  busy: boolean
  onDecide: (corner: Corner) => void | Promise<void>
  onCorrectExtra: () => void
}) {
  return (
    <div className={judgeStyles.clockModule}>
      <div className="w-full space-y-3 px-1 py-2">
        <div>
          <p className="text-sm font-bold text-white">Активность в доп. раунде</p>
          <p className="mt-0.5 text-xs text-[var(--judge-clock-muted)]">Кто был активнее?</p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            className={judgeStyles.prepActionBtnPrimary}
            disabled={busy || !controlsEnabled}
            onClick={() => void onDecide('red')}
          >
            Красный активнее
          </button>
          <button
            type="button"
            className={judgeStyles.prepActionBtnBlue}
            disabled={busy || !controlsEnabled}
            onClick={() => void onDecide('blue')}
          >
            Синий активнее
          </button>
        </div>

        <button
          type="button"
          className={judgeStyles.btnCancelCorrection}
          disabled={!controlsEnabled || busy}
          onClick={onCorrectExtra}
        >
          Исправить счёт extra
        </button>
      </div>
    </div>
  )
}
