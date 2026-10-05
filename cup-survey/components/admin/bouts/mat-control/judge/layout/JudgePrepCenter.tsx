'use client'

import { JudgeFightTimeButton } from '../JudgeFightTimeButton'
import { judgeStyles } from '../judgeModeStyles'
import { ATHLETE_WAIT_NO_SHOW_MS } from '@/lib/bouts/athleteWait'
import { formatJudgeLimitTimer } from '../judgeUtils'

export function JudgePrepCenter({
  waitCorner,
  waitElapsedMs,
  controlsEnabled,
  onStartBout,
}: {
  waitCorner: 'red' | 'blue' | null
  waitElapsedMs: number | null
  controlsEnabled: boolean
  onStartBout: () => void
}) {
  const waitTimer =
    waitCorner && waitElapsedMs != null
      ? formatJudgeLimitTimer(waitElapsedMs, ATHLETE_WAIT_NO_SHOW_MS)
      : null

  return (
    <div className={judgeStyles.clockModule}>
      <div className={judgeStyles.clockStack}>
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--judge-clock-muted)]">
          Подготовка к поединку
        </p>

        {waitTimer ? (
          <>
            <p className={judgeStyles.clock}>{waitTimer.ratio}</p>
            <p className={judgeStyles.clockMeta}>
              Ожидание · {waitCorner === 'red' ? 'красный' : 'синий'}
              {waitTimer.overtime ? ` · сверх лимита ${waitTimer.overtime}` : ''}
            </p>
          </>
        ) : (
          <p className="py-4 text-sm text-[var(--judge-clock-muted)]">Спортсмены готовы к поединку</p>
        )}
      </div>

      <div className="mt-2 w-full">
        <JudgeFightTimeButton
          prepLabel
          disabled={!controlsEnabled}
          onClick={onStartBout}
          clockRunning={false}
        />
      </div>
    </div>
  )
}
