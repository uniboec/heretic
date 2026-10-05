import { TOURNAMENT_TIMEZONE } from '../config/tournament'

const tournamentOffset = '+05:00'

const LOCAL_TIME_REGEX = /^(\d{2}):(\d{2})(?::(\d{2}))?$/

/** Builds a UTC instant from tournament calendar date + local HH:mm[:ss] in tournament timezone. */
export function toTournamentInstant(input: {
  eventDate: string
  localTime: string
  timeZone?: string
}): Date {
  void input.timeZone
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.eventDate)
  if (!dateMatch) {
    throw new Error(`Invalid eventDate: ${input.eventDate}`)
  }

  const timeMatch = LOCAL_TIME_REGEX.exec(input.localTime.trim())
  if (!timeMatch) {
    throw new Error(`Invalid localTime: ${input.localTime}`)
  }

  const [, year, month, day] = dateMatch
  const [, hour, minute, second = '00'] = timeMatch
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${tournamentOffset}`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid tournament instant: ${iso}`)
  }
  return date
}

export { TOURNAMENT_TIMEZONE }

/** Значение для input[type=datetime-local] в часовом поясе турнира. */
export function toTournamentDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TOURNAMENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** Парсит datetime-local как время турнира (Екатеринбург, UTC+5). */
export function fromTournamentDatetimeLocalValue(
  value: string | null | undefined,
  options?: { inclusiveEnd?: boolean },
): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(trimmed)
  if (!match) return null

  const [, year, month, day, hour, minute] = match
  const seconds = options?.inclusiveEnd ? '59' : '00'
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${seconds}${tournamentOffset}`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function formatTournamentDateTime(iso: string | null | undefined): string {
  if (!iso) return ''

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TOURNAMENT_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/** Короткая дата закрытия регистрации без года: «25 сентября, 20:00». */
export function formatRegistrationCloseShort(iso: string | null | undefined): string {
  if (!iso) return ''

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TOURNAMENT_TIMEZONE,
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
