export const MIN_BOUT_PERIOD_DURATION_MS = 10_000
export const MAX_BOUT_PERIOD_DURATION_MS = 60 * 60_000

export class InvalidBoutDurationInputError extends Error {
  constructor(message = 'Некорректная длительность') {
    super(message)
    this.name = 'InvalidBoutDurationInputError'
  }
}

function assertDurationMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < MIN_BOUT_PERIOD_DURATION_MS || ms > MAX_BOUT_PERIOD_DURATION_MS) {
    throw new InvalidBoutDurationInputError(
      `Длительность должна быть от ${MIN_BOUT_PERIOD_DURATION_MS / 1000} до ${MAX_BOUT_PERIOD_DURATION_MS / 60_000} мин`,
    )
  }
  return Math.round(ms)
}

/** Parses judge-facing duration text: 3:00, 3, 2.5, 2m30s, 180s, 180. */
export function parseBoutDurationInput(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new InvalidBoutDurationInputError('Укажите длительность')
  }

  const normalized = trimmed.replace(/\s+/g, '').toLowerCase().replace(/,/g, '.')

  const colonMatch = /^(\d+):(\d{1,2})$/.exec(normalized)
  if (colonMatch) {
    const minutes = Number(colonMatch[1])
    const seconds = Number(colonMatch[2])
    if (seconds >= 60) {
      throw new InvalidBoutDurationInputError('Секунды должны быть меньше 60')
    }
    return assertDurationMs((minutes * 60 + seconds) * 1000)
  }

  const compactMatch = /^(\d+)m(?:(\d{1,2})s?)?$/.exec(normalized)
  if (compactMatch) {
    const minutes = Number(compactMatch[1])
    const seconds = compactMatch[2] ? Number(compactMatch[2]) : 0
    if (seconds >= 60) {
      throw new InvalidBoutDurationInputError('Секунды должны быть меньше 60')
    }
    return assertDurationMs((minutes * 60 + seconds) * 1000)
  }

  const secondsSuffixMatch = /^(\d+(?:\.\d+)?)s$/.exec(normalized)
  if (secondsSuffixMatch) {
    return assertDurationMs(Number(secondsSuffixMatch[1]) * 1000)
  }

  const minutesSuffixMatch = /^(\d+(?:\.\d+)?)(?:m|min|м|мин)$/.exec(normalized)
  if (minutesSuffixMatch) {
    return assertDurationMs(Number(minutesSuffixMatch[1]) * 60_000)
  }

  if (/^\d+\.\d+$/.test(normalized)) {
    return assertDurationMs(Number(normalized) * 60_000)
  }

  if (/^\d+$/.test(normalized)) {
    const value = Number(normalized)
    if (value <= 60) {
      return assertDurationMs(value * 60_000)
    }
    return assertDurationMs(value * 1000)
  }

  throw new InvalidBoutDurationInputError('Формат: 3:00, 3, 2.5, 2m30s или 180s')
}

export function formatBoutDurationInput(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
