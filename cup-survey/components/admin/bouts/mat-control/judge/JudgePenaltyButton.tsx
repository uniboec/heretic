'use client'

import { formatNextSanctionPreview } from '@/lib/bouts/presentation/formatNextSanction'
import type { PenaltyLadder, PenaltySanction } from '@/lib/config/fseRules'
import type { Corner } from '@/lib/bouts/mat-control/types'
import { judgeStyles } from './judgeModeStyles'

export function JudgePenaltyButton({
  title,
  nextSanction,
  ladder,
  corner,
  disabled,
  onClick,
  variant = 'default',
  compact = false,
  compactTitle,
}: {
  title: string
  nextSanction: PenaltySanction
  ladder: PenaltyLadder
  corner: Corner
  disabled?: boolean
  onClick: () => void
  variant?: 'default' | 'warning'
  compact?: boolean
  compactTitle?: string
}) {
  const isDq = nextSanction === 'DISQUALIFICATION'
  const label = isDq
    ? compact
      ? '⚠ ДСК'
      : '⚠ Дисквалификация'
    : compact
      ? (compactTitle ?? title)
      : title
  const preview = isDq
    ? compact ? 'Конец боя' : 'Завершит поединок'
    : formatNextSanctionPreview(nextSanction, ladder)

  const tintClass =
    isDq || variant === 'warning'
      ? judgeStyles.btnPenaltyDq
      : corner === 'red'
        ? judgeStyles.btnPenaltyTintRed
        : judgeStyles.btnPenaltyTintBlue

  if (compact) {
    const hint = disabled ? 'Управление недоступно' : isDq ? preview : `${title} — ${preview}`
    return (
      <button
        type="button"
        className={`${judgeStyles.btnPenaltyCompact} ${tintClass}`}
        disabled={disabled}
        onClick={onClick}
        title={hint}
      >
        <span className={isDq ? judgeStyles.btnPenaltyTitleDqCompact : judgeStyles.btnPenaltyTitleCompact}>
          {label}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`${judgeStyles.btnPenalty} ${tintClass}`}
      disabled={disabled}
      onClick={onClick}
      title={disabled ? 'Управление недоступно' : undefined}
    >
      <div className={judgeStyles.btnPenaltyBody}>
        <span className={isDq ? judgeStyles.btnPenaltyTitleDq : judgeStyles.btnPenaltyTitle}>
          {label}
        </span>
        <span className={isDq ? judgeStyles.btnPenaltyPreviewDq : judgeStyles.btnPenaltyPreview}>
          {preview}
        </span>
      </div>
      <span className={judgeStyles.btnPenaltyChevron} aria-hidden>›</span>
    </button>
  )
}
