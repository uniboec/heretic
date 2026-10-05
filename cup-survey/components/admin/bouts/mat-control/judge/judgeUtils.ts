/** Countdown timers (period remaining) — round up so 0:01 stays until the second elapses. */
export function formatJudgeClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** Elapsed / count-up timers — round down so thresholds fire when the display hits the limit. */
export function formatJudgeElapsedClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** Bout clock position at event time, e.g. 0:15 */
export function formatBoutElapsedTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export type JudgeLimitTimerParts = {
  elapsed: string
  limit: string
  ratio: string
  overtime: string | null
  overLimit: boolean
}

/** Elapsed/limit display for per-athlete correction timers (e.g. 1:45/2:00, +0:08 overtime). */
export function formatJudgeLimitTimer(elapsedMs: number, limitMs: number): JudgeLimitTimerParts {
  const elapsed = formatJudgeElapsedClock(elapsedMs)
  const limit = formatJudgeElapsedClock(limitMs)
  const overLimit = elapsedMs >= limitMs
  const overtimeMs = overLimit ? Math.max(0, elapsedMs - limitMs) : 0
  const overtime = overLimit ? `+${formatJudgeElapsedClock(overtimeMs)}` : null

  return {
    elapsed,
    limit,
    ratio: `${elapsed}/${limit}`,
    overtime,
    overLimit,
  }
}

export function formatCornerAuxTimerLabel(
  label: string,
  elapsedMs: number,
  limitMs: number,
  isActive: boolean,
): string {
  const timer = formatJudgeLimitTimer(elapsedMs, limitMs)
  const body = timer.overtime ? `${timer.ratio} ${timer.overtime}` : timer.ratio
  const text = `${label} ${body}`
  return isActive ? `● ${text}` : text
}

export function createOperationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const SNAPSHOT_STALE_MS = 20_000
