import { TOURNAMENT_TIMEZONE } from '../config/tournament'
import {
  formatBoutDisplayStatus,
  resolveBoutDisplayStatusFromTiming,
} from './presentation/boutDisplayStatus'
import { formatBoutTime } from './startTimes'
import type { BoutTiming } from './scheduleTypes'

export interface PublicBoutTimingPresentation {
  statusLabel: string
  startTime?: string
  approximate?: boolean
  live?: boolean
  secondary?: string
  delayLabel?: string
}

export function formatPublicBoutTiming(
  timing: BoutTiming,
  _referenceNow: Date = new Date(),
): PublicBoutTimingPresentation {
  const displayStatus = resolveBoutDisplayStatusFromTiming(timing)
  const statusLabel = formatBoutDisplayStatus(displayStatus)

  if (displayStatus === 'completed') {
    if (!timing.actualStartAt) {
      return { statusLabel }
    }
    return {
      statusLabel,
      startTime: formatBoutTime(timing.actualStartAt, TOURNAMENT_TIMEZONE),
    }
  }

  if (displayStatus === 'in_progress') {
    const started = timing.actualStartAt
      ? formatBoutTime(timing.actualStartAt, TOURNAMENT_TIMEZONE)
      : undefined
    return {
      statusLabel,
      startTime: started,
      live: true,
      secondary: started ? `начался в ${started}` : undefined,
    }
  }

  const estimatedStart = formatBoutTime(timing.estimatedStartAt, TOURNAMENT_TIMEZONE)
  const scheduledStart = formatBoutTime(timing.scheduledStartAt, TOURNAMENT_TIMEZONE)

  if (timing.isDelayed) {
    return {
      statusLabel,
      startTime: estimatedStart,
      approximate: true,
      secondary: scheduledStart ? `по плану ${scheduledStart}` : undefined,
      delayLabel: `Задержка +${timing.delayMinutes} мин`,
    }
  }

  return {
    statusLabel,
    startTime: estimatedStart,
    approximate: displayStatus === 'scheduled',
  }
}

export function formatMatHeader(input: {
  matIndex: number
  configuredStartTime: string
  estimatedEndAt: string | null
}): string {
  const end = input.estimatedEndAt
    ? formatBoutTime(input.estimatedEndAt, TOURNAMENT_TIMEZONE)
    : null
  return end
    ? `Ковёр ${input.matIndex}\nначало ${input.configuredStartTime} → ≈ конец ${end}`
    : `Ковёр ${input.matIndex}\nначало ${input.configuredStartTime}`
}
