import type { AnnouncerEvent, AnnouncerEventType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { ValidityContext } from './validity'
import { isEventStillValid } from './validity'

export function scopeEventType(scopeKey: string): AnnouncerEventType {
  if (scopeKey.startsWith('award:')) {
    return scopeKey.endsWith(':prepare') ? 'AWARD_PREPARE' : 'AWARD_CALL'
  }
  return scopeKey.endsWith(':prepare') ? 'BOUT_PREPARE' : 'BOUT_CALL'
}

function eventMatchesPosition(
  event: AnnouncerEvent,
  positionId: string,
): boolean {
  const payload = event.payload as Record<string, unknown>
  if (event.type.startsWith('BOUT_')) {
    return payload.boutId === positionId
  }
  return payload.queueId === positionId
}

export function isPositionAnnouncementCovered(
  event: AnnouncerEvent,
  positionId: string,
  ctx: ValidityContext,
): boolean {
  if (!eventMatchesPosition(event, positionId)) return false
  if (['QUEUED', 'GENERATING', 'READY', 'PLAYING'].includes(event.status)) return true
  if (event.status === 'PLAYED') return isEventStillValid(event, ctx)
  return false
}

export async function findUncoveredPositionScopes(
  scopeId: string,
  ctx: ValidityContext,
): Promise<Array<{ scopeKey: string; positionId: string }>> {
  const positions = await prisma.announcerPositionState.findMany({
    where: { tournamentScopeId: scopeId, currentPositionId: { not: null } },
  })
  if (positions.length === 0) return []

  const recentEvents = await prisma.announcerEvent.findMany({
    where: {
      tournamentScopeId: scopeId,
      createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const uncovered: Array<{ scopeKey: string; positionId: string }> = []

  for (const position of positions) {
    const positionId = position.currentPositionId
    if (!positionId) continue

    const eventType = scopeEventType(position.scopeKey)
    const relevant = recentEvents.filter((event) => event.type === eventType)
    const covered = relevant.some((event) =>
      isPositionAnnouncementCovered(event, positionId, ctx),
    )
    if (!covered) {
      uncovered.push({ scopeKey: position.scopeKey, positionId })
    }
  }

  return uncovered
}
