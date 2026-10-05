import { tournamentInfo } from '@/lib/config/tournament'
import { toTournamentInstant } from '@/lib/datetime/tournament'
import type { AwardsPageSettings, QueueWithPlacements } from '../types'

export type CeremonyTiming = {
  scheduledStartAt: string
  estimatedStartAt: string
  estimatedEndAt: string
  actualStartAt?: string
  actualEndAt?: string
  delayMinutes: number
  durationMinutes: number
}

export type ScheduledCeremonyCategory = {
  queueId: string
  categoryKey: string
  status: QueueWithPlacements['status']
  queueGroup: QueueWithPlacements['queueGroup']
  queueOrder: number
  ceremonySequence: number | null
  timing: CeremonyTiming
  placements: QueueWithPlacements['placements']
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function diffMinutes(later: Date, earlier: Date): number {
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / 60_000))
}

function toIso(date: Date): string {
  return date.toISOString()
}

function compareTimeline(left: QueueWithPlacements, right: QueueWithPlacements): number {
  if (left.status === 'COMPLETED' && right.status === 'COMPLETED') {
    return (left.ceremonySequence ?? 0) - (right.ceremonySequence ?? 0)
  }
  if (left.status === 'COMPLETED') return -1
  if (right.status === 'COMPLETED') return 1
  if (left.status === 'IN_PROGRESS') return -1
  if (right.status === 'IN_PROGRESS') return 1
  if (left.queueGroup !== right.queueGroup) {
    return left.queueGroup === 'NORMAL' ? -1 : 1
  }
  return left.queueOrder - right.queueOrder
}

function resolveDurationMinutes(queue: QueueWithPlacements, settings: AwardsPageSettings): number {
  if (queue.durationMinutesSnapshot != null) {
    return queue.durationMinutesSnapshot
  }
  return settings.ceremonyDurationMinutes
}

function resolveBreakMinutes(queue: QueueWithPlacements, settings: AwardsPageSettings): number {
  if (queue.breakMinutesSnapshot != null) {
    return queue.breakMinutesSnapshot
  }
  return settings.ceremonyBreakMinutes
}

export function buildCeremonySchedule(input: {
  queue: QueueWithPlacements[]
  settings: AwardsPageSettings
  now: Date
  includeStatuses?: Array<QueueWithPlacements['status']>
}): ScheduledCeremonyCategory[] {
  const include = new Set(
    input.includeStatuses ?? ['COMPLETED', 'IN_PROGRESS', 'PENDING'],
  )
  const timeline = input.queue
    .filter((item) => include.has(item.status))
    .sort(compareTimeline)

  const ceremonyStartInstant = toTournamentInstant({
    eventDate: tournamentInfo.eventDate,
    localTime: input.settings.ceremonyStartTime,
  })

  let liveCursor = ceremonyStartInstant
  let pendingPlannedCursor = ceremonyStartInstant
  const scheduled: ScheduledCeremonyCategory[] = []

  for (const item of timeline) {
    const duration = resolveDurationMinutes(item, input.settings)
    const breakMinutes = resolveBreakMinutes(item, input.settings)

    if (item.status === 'COMPLETED') {
      const actualStartAt = item.actualStartAt ?? item.scheduledStartAtSnapshot ?? liveCursor
      const actualEndAt = item.actualEndAt ?? addMinutes(actualStartAt, duration)
      const scheduledStartAt = item.scheduledStartAtSnapshot ?? actualStartAt
      liveCursor = addMinutes(actualEndAt, breakMinutes)

      scheduled.push({
        queueId: item.id,
        categoryKey: item.categoryKey,
        status: item.status,
        queueGroup: item.queueGroup,
        queueOrder: item.queueOrder,
        ceremonySequence: item.ceremonySequence,
        placements: item.placements,
        timing: {
          scheduledStartAt: toIso(scheduledStartAt),
          estimatedStartAt: toIso(actualStartAt),
          estimatedEndAt: toIso(actualEndAt),
          actualStartAt: toIso(actualStartAt),
          actualEndAt: toIso(actualEndAt),
          delayMinutes: diffMinutes(actualStartAt, scheduledStartAt),
          durationMinutes: duration,
        },
      })
      continue
    }

    if (item.status === 'IN_PROGRESS') {
      const actualStartAt = item.actualStartAt ?? input.now
      const estimatedEndAt =
        addMinutes(actualStartAt, duration).getTime() > input.now.getTime()
          ? addMinutes(actualStartAt, duration)
          : input.now
      liveCursor = addMinutes(estimatedEndAt, breakMinutes)
      const scheduledStartAt = item.scheduledStartAtSnapshot ?? actualStartAt

      scheduled.push({
        queueId: item.id,
        categoryKey: item.categoryKey,
        status: item.status,
        queueGroup: item.queueGroup,
        queueOrder: item.queueOrder,
        ceremonySequence: item.ceremonySequence,
        placements: item.placements,
        timing: {
          scheduledStartAt: toIso(scheduledStartAt),
          estimatedStartAt: toIso(actualStartAt),
          estimatedEndAt: toIso(estimatedEndAt),
          actualStartAt: toIso(actualStartAt),
          delayMinutes: diffMinutes(actualStartAt, scheduledStartAt),
          durationMinutes: duration,
        },
      })
      continue
    }

    const scheduledStartAt = pendingPlannedCursor
    const estimatedStartAt =
      liveCursor.getTime() > scheduledStartAt.getTime() ? liveCursor : scheduledStartAt
    const estimatedEndAt = addMinutes(estimatedStartAt, duration)
    liveCursor = addMinutes(estimatedEndAt, breakMinutes)
    pendingPlannedCursor = addMinutes(scheduledStartAt, duration + breakMinutes)

    scheduled.push({
      queueId: item.id,
      categoryKey: item.categoryKey,
      status: item.status,
      queueGroup: item.queueGroup,
      queueOrder: item.queueOrder,
      ceremonySequence: item.ceremonySequence,
      placements: item.placements,
      timing: {
        scheduledStartAt: toIso(scheduledStartAt),
        estimatedStartAt: toIso(estimatedStartAt),
        estimatedEndAt: toIso(estimatedEndAt),
        delayMinutes: diffMinutes(estimatedStartAt, scheduledStartAt),
        durationMinutes: duration,
      },
    })
  }

  return scheduled
}
