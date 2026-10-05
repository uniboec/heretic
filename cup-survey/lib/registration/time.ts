import { TOURNAMENT_TIMEZONE } from '../config/tournament'
import { getRegistrationScheduleSync } from './schedule'

function parseInTimezone(iso: string): number {
  return new Date(iso).getTime()
}

export function getServerNow(): Date {
  return new Date()
}

export function isRegistrationClosed(now = getServerNow()): boolean {
  const { registrationClosesAt } = getRegistrationScheduleSync()
  return now.getTime() > parseInTimezone(registrationClosesAt)
}

export function getCurrentRegistrationStage(now = getServerNow()): string | null {
  if (isRegistrationClosed(now)) return null

  const { stages } = getRegistrationScheduleSync()
  const ts = now.getTime()

  for (const stage of stages) {
    const starts = stage.startsAt ? parseInTimezone(stage.startsAt) : Number.NEGATIVE_INFINITY
    const ends = parseInTimezone(stage.endsAt)
    if (ts >= starts && ts <= ends) return stage.id
  }

  return null
}

export function getStageEndAt(stageId: string): string {
  const stage = getRegistrationScheduleSync().stagesById[stageId]
  if (!stage) throw new Error(`Unknown registration stage: ${stageId}`)
  return stage.endsAt
}

export function getStageConfig(stageId: string) {
  const stage = getRegistrationScheduleSync().stagesById[stageId]
  if (!stage) throw new Error(`Unknown registration stage: ${stageId}`)
  return stage
}

export function getPricePerDiscipline(stageId: string): number {
  return getStageConfig(stageId).pricePerDiscipline
}

export function getRegistrationCloseMs(): number {
  return parseInTimezone(getRegistrationScheduleSync().registrationClosesAt)
}

export function getStageEndMs(stageId: string): number {
  return parseInTimezone(getStageEndAt(stageId))
}

export function formatCountdownParts(targetMs: number, now = getServerNow()) {
  const diff = Math.max(0, targetMs - now.getTime())
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds, totalMs: diff }
}

export function getTimezoneLabel(): string {
  return TOURNAMENT_TIMEZONE
}
