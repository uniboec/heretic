import { TOURNAMENT_TIMEZONE } from '../config/tournament'

/** Countdown helpers — full ISO instants, presentation only. */

export function diffMinutes(later: Date, earlier: Date): number {
  return Math.max(0, Math.ceil((later.getTime() - earlier.getTime()) / 60_000))
}

function tournamentLocalDateKey(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TOURNAMENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function minutesUntil(iso: string, referenceNow: Date): number | null {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return null
  const diffMs = target.getTime() - referenceNow.getTime()
  if (diffMs <= 0) return null
  return Math.ceil(diffMs / 60_000)
}

export function formatCountdownLabel(iso: string, referenceNow: Date): string | null {
  const minutes = minutesUntil(iso, referenceNow)
  if (minutes == null) return null

  const target = new Date(iso)
  if (tournamentLocalDateKey(target) !== tournamentLocalDateKey(referenceNow)) {
    return null
  }

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    if (remainder === 0) return `через ${hours} ч`
    return `через ${hours} ч ${remainder} мин`
  }

  return `через ${minutes} мин`
}
