import { formatMatControlEvent } from '@/lib/bouts/presentation/formatMatControlEvent'
import { formatTechnicalScoreActionFromPayload } from '@/lib/bouts/presentation/formatTechnicalScoreAction'
import type { BoutEventRecord, Corner } from '@/lib/bouts/mat-control/types'

export type JudgeHistoryLine = {
  time: string
  label: string
  /** Human-readable label for the primary “last action” row */
  primaryLabel: string
  /** Compact action for command log, e.g. +2, НАРУШЕНИЕ */
  logAction: string
  corner: Corner | null
  cornerLabel: string | null
  isHighlight: boolean
}

function formatTime(createdAt: Date | string): string {
  const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function cornerName(corner: Corner | null): string {
  if (corner === 'red') return 'Красный'
  if (corner === 'blue') return 'Синий'
  return ''
}

function cornerUpper(corner: Corner | null): string | null {
  if (corner === 'red') return 'КРАСНЫЙ'
  if (corner === 'blue') return 'СИНИЙ'
  return null
}

function cornerDative(corner: Corner | null): string {
  if (corner === 'red') return 'Красному'
  if (corner === 'blue') return 'Синему'
  return ''
}

function pointsWord(n: number): string {
  if (n === 1) return 'балл'
  if (n >= 2 && n <= 4) return 'балла'
  return 'баллов'
}

export function formatJudgeHistoryLine(event: BoutEventRecord): JudgeHistoryLine {
  const time = formatTime(event.createdAt)

  if (event.eventType === 'TECHNICAL_SCORE') {
    const corner = event.cornerAtEvent
    const points = event.points ?? 0
    const actionLabel = formatTechnicalScoreActionFromPayload(event.payload)
    const short = actionLabel
      ? `${cornerName(corner)} +${points} · ${actionLabel}`
      : `${cornerName(corner)} +${points}`
    const upper = cornerUpper(corner) ?? cornerName(corner)
    const primary = actionLabel
      ? `${upper} +${points} · ${actionLabel.toUpperCase()}`
      : `${upper} +${points} ${pointsWord(points).toUpperCase()}`
    return {
      time,
      label: short,
      primaryLabel: primary,
      logAction: actionLabel ? `+${points} ${actionLabel}` : `+${points}`,
      corner,
      cornerLabel: cornerUpper(corner),
      isHighlight: true,
    }
  }

  if (event.eventType === 'PENALTY') {
    const corner = event.cornerAtEvent
    const points = event.points ?? 0
    if (points > 0) {
      const opponent = corner === 'red' ? 'blue' : 'red'
      const short = `${cornerName(opponent)} +${points}`
      const upper = cornerUpper(opponent)
      const primary = `${upper} +${points} ${pointsWord(points).toUpperCase()}`
      return {
        time,
        label: short,
        primaryLabel: primary,
        logAction: `+${points}`,
        corner: opponent,
        cornerLabel: upper,
        isHighlight: true,
      }
    }
    const label = `Нарушение · ${cornerName(corner)}`
    const upper = cornerUpper(corner)
    const primary = upper ? `Нарушение · ${upper}` : label
    return {
      time,
      label,
      primaryLabel: primary,
      logAction: 'НАРУШЕНИЕ',
      corner,
      cornerLabel: upper,
      isHighlight: false,
    }
  }

  if (event.eventType === 'BOUT_STOPPAGE' || event.eventType === 'CLOCK_STOP') {
    const label = 'Бой остановлен'
    return {
      time,
      label,
      primaryLabel: label,
      logAction: 'БОЙ ОСТАНОВЛЕН',
      corner: null,
      cornerLabel: null,
      isHighlight: false,
    }
  }

  const label = formatMatControlEvent(event)
  const corner = event.cornerAtEvent
  return {
    time,
    label,
    primaryLabel: label,
    logAction: label.toUpperCase(),
    corner,
    cornerLabel: cornerUpper(corner),
    isHighlight: false,
  }
}
