import { prisma } from '@/lib/prisma'
import type { AnnouncerEvent, AnnouncerEventType, Prisma } from '@prisma/client'
import { getRuleForType } from './rules'
import { DEFAULT_TTL_SECONDS } from './types'
import { isEventStillValid, isPositionBasedAnnouncerEvent, type ValidityContext } from './validity'

const ACTIVE_STATUSES = ['QUEUED', 'GENERATING', 'READY', 'PLAYING'] as const

export function expireEventData(): Prisma.AnnouncerEventUpdateManyMutationInput {
  return {
    status: 'EXPIRED',
    claimToken: null,
    claimedAt: null,
    leaseUntil: null,
    generationToken: null,
    generationStartedAt: null,
    generationLeaseUntil: null,
    generationTtsSignature: null,
  }
}

/**
 * Expires announcements that are no longer relevant (position moved on, repeat window
 * ended, TTL elapsed for manual/repeat events) and extends TTL only for still-valid
 * position-based auto announcements.
 */
export async function expireStaleAnnouncerEvents(
  scopeId: string,
  ctx: ValidityContext,
): Promise<number> {
  const candidates = await prisma.announcerEvent.findMany({
    where: {
      tournamentScopeId: scopeId,
      status: { in: [...ACTIVE_STATUSES] },
    },
  })

  let expiredCount = 0

  for (const event of candidates) {
    const stillValid = isEventStillValid(event, ctx)

    if (!stillValid) {
      const result = await prisma.announcerEvent.updateMany({
        where: { id: event.id, status: event.status },
        data: expireEventData(),
      })
      expiredCount += result.count
      continue
    }

    if (!event.expiresAt || event.expiresAt >= new Date()) continue

    if (isPositionBasedAnnouncerEvent(event)) {
      const rule = await getRuleForType(event.type, scopeId)
      const ttlSeconds = rule.ttlSeconds ?? DEFAULT_TTL_SECONDS[event.type as AnnouncerEventType]
      await prisma.announcerEvent.updateMany({
        where: { id: event.id, status: event.status },
        data: { expiresAt: new Date(Date.now() + ttlSeconds * 1000) },
      })
      continue
    }

    const result = await prisma.announcerEvent.updateMany({
      where: { id: event.id, status: event.status },
      data: expireEventData(),
    })
    expiredCount += result.count
  }

  return expiredCount
}

export async function expireAnnouncerEvent(
  event: Pick<AnnouncerEvent, 'id' | 'status'>,
): Promise<boolean> {
  const result = await prisma.announcerEvent.updateMany({
    where: { id: event.id, status: event.status },
    data: expireEventData(),
  })
  return result.count === 1
}

/** @deprecated Use expireStaleAnnouncerEvents */
export async function expireTimedOutAnnouncerEvents(
  scopeId: string,
  ctx: ValidityContext,
): Promise<number> {
  return expireStaleAnnouncerEvents(scopeId, ctx)
}
