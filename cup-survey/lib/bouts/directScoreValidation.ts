import type { BoutEventRecord } from './mat-control/types'
import { CommandNotAllowedError } from './mat-control/errors'

export type DirectScorePayload = {
  source?: string
  adminOverrideReason?: string
}

export function hasPriorScoringChronology(
  events: BoutEventRecord[],
  attemptNumber: number,
): boolean {
  return events.some(
    (event) =>
      !event.undoneAt &&
      event.attemptNumber === attemptNumber &&
      (event.eventType === 'TECHNICAL_SCORE' || event.eventType === 'ADJUDICATION'),
  )
}

export function assertDirectTechnicalScoreAllowed(input: {
  events: BoutEventRecord[]
  attemptNumber: number
  points: number
  payload?: DirectScorePayload
}): void {
  if (input.points <= 0) return

  const source = input.payload?.source
  if (source !== 'DIRECT') return

  if (input.payload?.adminOverrideReason?.trim()) return

  if (hasPriorScoringChronology(input.events, input.attemptNumber)) return

  throw new CommandNotAllowedError(
    'Прямой ввод очков без хронологии событий запрещён. Используйте технические действия или укажите причину admin override.',
  )
}
