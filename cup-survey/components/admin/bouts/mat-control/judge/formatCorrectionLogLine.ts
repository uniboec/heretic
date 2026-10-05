import type { BoutEventRecord, Corner } from '@/lib/bouts/mat-control/types'

export type CorrectionLogLine = {
  id: string
  time: string
  corner: Corner | null
  cornerLabel: string | null
  action: string
}

function formatTime(createdAt: Date | string): string {
  const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function cornerDative(corner: Corner | null): string | null {
  if (corner === 'red') return 'Красному'
  if (corner === 'blue') return 'Синему'
  return null
}

function cornerUpper(corner: Corner | null): string | null {
  if (corner === 'red') return 'КРАСНЫЙ'
  if (corner === 'blue') return 'СИНИЙ'
  return null
}

export function formatCorrectionLogLine(event: BoutEventRecord): CorrectionLogLine {
  const time = formatTime(event.createdAt)

  if (event.eventType === 'TECHNICAL_SCORE') {
    const corner = event.cornerAtEvent
    const points = event.points ?? 0
    return {
      id: event.id,
      time,
      corner,
      cornerLabel: cornerUpper(corner),
      action: `${cornerDative(corner)} +${points}`,
    }
  }

  if (event.eventType === 'PENALTY') {
    const corner = event.cornerAtEvent
    const points = event.points ?? 0
    if (points > 0) {
      const opponent = corner === 'red' ? 'blue' : 'red'
      return {
        id: event.id,
        time,
        corner: opponent,
        cornerLabel: cornerUpper(opponent),
        action: `${cornerDative(opponent)} +${points}`,
      }
    }
    return {
      id: event.id,
      time,
      corner,
      cornerLabel: cornerUpper(corner),
      action: `Нарушение · ${cornerDative(corner)}`,
    }
  }

  return {
    id: event.id,
    time,
    corner: event.cornerAtEvent,
    cornerLabel: cornerUpper(event.cornerAtEvent),
    action: event.eventType,
  }
}

export function getCorrectionPeriodEvents(
  events: BoutEventRecord[],
  period: 'main' | 'extra',
  attemptNumber: number,
): BoutEventRecord[] {
  return events.filter(
    (event) =>
      !event.undoneAt &&
      event.attemptNumber === attemptNumber &&
      event.period === period &&
      (event.eventType === 'TECHNICAL_SCORE' || event.eventType === 'PENALTY'),
  )
}
