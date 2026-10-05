import type { VictoryMethod } from '@/lib/config/fseRules'
import type { BoutEventRecord } from './mat-control/types'
import { wasFightClockStarted } from '@/lib/fastestFights/fightClockStarted'
import { reduceScoreEvents } from './scoreEngine'

export type RequiresOfficialStartConfig = Partial<Record<VictoryMethod, boolean>>

/** Default cup26-type tournament: real points fights need official clock start. */
export const DEFAULT_REQUIRES_OFFICIAL_START: RequiresOfficialStartConfig = {
  POINTS: true,
  CLEAR_ADVANTAGE: true,
  TECHNICAL_SUPERIORITY: true,
  SUBMISSION: true,
  CHOKE: true,
  INJURY: true,
  DISQUALIFICATION: false,
  FORFEIT: false,
  NO_SHOW: false,
  KNOCKOUT: true,
  TECHNICAL_KNOCKOUT: true,
}

export function requiresOfficialStartForMethod(
  method: VictoryMethod,
  config: RequiresOfficialStartConfig = DEFAULT_REQUIRES_OFFICIAL_START,
): boolean {
  return config[method] ?? false
}

export type ConfirmValidationIssueCode =
  | 'CLOCK_START_REQUIRED'
  | 'INJURY_WITH_TECHNICAL_SCORE'
  | 'POINTS_SUSPICIOUSLY_SHORT'

export type ConfirmValidationIssue = {
  code: ConfirmValidationIssueCode
  message: string
}

export type ValidateConfirmInput = {
  victoryMethod: VictoryMethod
  events: BoutEventRecord[]
  attemptNumber: number
  period: 'main' | 'extra'
  requiresOfficialStart?: RequiresOfficialStartConfig
  /** Minimum bout elapsed ms to warn on non-zero POINTS score (default 30s). */
  pointsShortFightThresholdMs?: number
  /** When true, INJURY with technical score requires explicit operator acknowledgement. */
  injuryScoreAcknowledged?: boolean
}

export function validateConfirmBout(input: ValidateConfirmInput): ConfirmValidationIssue[] {
  const issues: ConfirmValidationIssue[] = []
  const config = input.requiresOfficialStart ?? DEFAULT_REQUIRES_OFFICIAL_START
  const clockStarted = wasFightClockStarted(input.events)

  if (requiresOfficialStartForMethod(input.victoryMethod, config) && !clockStarted) {
    issues.push({
      code: 'CLOCK_START_REQUIRED',
      message: 'Для выбранного способа победы требуется официальный старт боя (запуск таймера).',
    })
  }

  const mainScore = reduceScoreEvents(input.events, 'main', input.attemptNumber).officialScore
  const extraScore = reduceScoreEvents(input.events, 'extra', input.attemptNumber).officialScore
  const hasTechnicalScore =
    mainScore.red > 0 ||
    mainScore.blue > 0 ||
    extraScore.red > 0 ||
    extraScore.blue > 0

  if (
    input.victoryMethod === 'INJURY' &&
    hasTechnicalScore &&
    !input.injuryScoreAcknowledged
  ) {
    issues.push({
      code: 'INJURY_WITH_TECHNICAL_SCORE',
      message:
        'При победе по травме с ненулевым техническим счётом требуется подтверждение, что счёт был до остановки.',
    })
  }

  if (input.victoryMethod === 'POINTS' && hasTechnicalScore) {
    const elapsedMs = maxBoutElapsedMs(input.events)
    const threshold = input.pointsShortFightThresholdMs ?? 30_000
    if (elapsedMs < threshold) {
      issues.push({
        code: 'POINTS_SUSPICIOUSLY_SHORT',
        message: `Победа по очкам при счёте и длительности боя менее ${threshold / 1000} с — проверьте корректность.`,
      })
    }
  }

  return issues
}

export function assertConfirmBoutValid(input: ValidateConfirmInput): void {
  const issues = validateConfirmBout(input)
  if (issues.length > 0) {
    throw new ConfirmValidationError(issues)
  }
}

export class ConfirmValidationError extends Error {
  readonly issues: ConfirmValidationIssue[]

  constructor(issues: ConfirmValidationIssue[]) {
    super(issues.map((i) => i.message).join(' '))
    this.name = 'ConfirmValidationError'
    this.issues = issues
  }
}

function maxBoutElapsedMs(events: BoutEventRecord[]): number {
  let max = 0
  for (const event of events) {
    if (event.undoneAt) continue
    if (event.boutElapsedMs != null && event.boutElapsedMs > max) {
      max = event.boutElapsedMs
    }
  }
  return max
}

export function getBlockingConfirmIssues(
  issues: ConfirmValidationIssue[],
): ConfirmValidationIssue[] {
  return issues.filter(
    (issue) =>
      issue.code === 'CLOCK_START_REQUIRED' || issue.code === 'INJURY_WITH_TECHNICAL_SCORE',
  )
}

export function getConfirmDisabledReason(input: ValidateConfirmInput): string | undefined {
  const blocking = getBlockingConfirmIssues(validateConfirmBout(input))
  return blocking[0]?.message
}

export function resolveProposedVictoryMethod(events: BoutEventRecord[]): VictoryMethod {
  const stoppages = events.filter((event) => !event.undoneAt && event.eventType === 'BOUT_STOPPAGE')
  const latest = stoppages[stoppages.length - 1]
  const payload = (latest?.payload ?? {}) as { proposedVictoryMethod?: VictoryMethod }
  return payload.proposedVictoryMethod ?? 'POINTS'
}
