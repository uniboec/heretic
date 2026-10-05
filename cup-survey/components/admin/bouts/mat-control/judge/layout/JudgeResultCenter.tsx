'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import type { MatControlBoutSnapshot } from '@/lib/bouts/matControlSnapshot'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'
import { routes } from '@/lib/routes'
import { withBasePath } from '@/lib/basePath'
import { judgeStyles } from '../judgeModeStyles'

export function JudgeResultCenter({
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
  const { execution, confirmationSummary } = activeBout
  const isConfirmed = execution.boutPhase === 'confirmed'
  const nextAvailable = snapshot.queue.nextAvailable

  const winnerTint = 'border-accent/40 bg-accent-soft'

  return (
    <div className={judgeStyles.clockModule}>
      <div className="w-full space-y-3 px-1 py-2">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--judge-clock-muted)]">
          {isConfirmed ? 'Поединок завершён' : 'Проверьте результат'}
        </p>

        {confirmationSummary ? (
          <div className={`${judgeStyles.resultWinnerCard} ${winnerTint}`}>
            <p className="text-lg font-bold text-foreground">{confirmationSummary.winnerLabel}</p>
            <p className="mt-1 text-sm text-muted">{confirmationSummary.victoryMethodLabel}</p>
            <p className="mt-0.5 text-sm tabular-nums text-muted">
              {confirmationSummary.extraScore
                ? `Основное время: ${confirmationSummary.mainScore} · Доп. раунд: ${confirmationSummary.extraScore}`
                : `Счёт: ${confirmationSummary.mainScore}`}
            </p>
            {confirmationSummary.countsForFastestFights && !isConfirmed ? (
              <p className="mt-2 text-xs font-medium text-accent">
                Попадёт в рейтинг самых быстрых поединков
                {confirmationSummary.fastestFightTimeLabel
                  ? ` · ${confirmationSummary.fastestFightTimeLabel}`
                  : ''}
              </p>
            ) : null}
          </div>
        ) : null}

        {isConfirmed ? (
          <div className="space-y-2">
            {nextAvailable ? (
              <button
                type="button"
                className={judgeStyles.btnApplyCorrection}
                disabled={!controlsEnabled}
                onClick={onOpenNextBout}
              >
                Перейти к следующему поединку
              </button>
            ) : null}
            <div className="flex flex-wrap justify-center gap-2">
              <Link href={withBasePath(routes.admin.bouts)}>
                <Button variant="secondary" size="md">Порядок поединков</Button>
              </Link>
              <Button variant="secondary" size="md" type="button">Оставаться здесь</Button>
            </div>
            {onEditResult ? (
              <button type="button" className={judgeStyles.btnCancelCorrection} onClick={onEditResult}>
                Изменить результат
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            {fightClockStarted === false ? (
              <p className="text-center text-xs font-medium text-amber-700">
                Таймер не запущен — проверьте способ победы перед подтверждением
              </p>
            ) : null}
            {confirmValidationWarnings?.map((warning) => (
              <p key={warning} className="text-center text-xs text-amber-700">{warning}</p>
            ))}
            {confirmDisabledReason ? (
              <p className="text-center text-xs text-muted">{confirmDisabledReason}</p>
            ) : null}
            {showInjuryScoreAck ? (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={injuryScoreAcknowledged ?? false}
                  onChange={(e) => onInjuryScoreAckChange?.(e.target.checked)}
                />
                <span>Счёт был набран до остановки по травме</span>
              </label>
            ) : null}
            <button
              type="button"
              className={judgeStyles.btnApplyCorrection}
              disabled={!controlsEnabled || Boolean(confirmDisabledReason)}
              title={confirmDisabledReason}
              onClick={onConfirm}
            >
              Подтвердить результат
            </button>
            <button
              type="button"
              className={judgeStyles.btnCancelCorrection}
              disabled={!controlsEnabled}
              onClick={onCancelStoppage}
            >
              Отменить остановку
            </button>
            {onEditResult ? (
              <button type="button" className={judgeStyles.btnCancelCorrection} onClick={onEditResult}>
                Исправить результат
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
