import type { AnnouncerEvent, AnnouncerEventType } from '@prisma/client'
import type {
  AwardCallPayload,
  BoutCallPayload,
  BoutResultPayload,
} from './types'

export type ValidityContext = {
  boutQueueByMat?: Record<number, [string | undefined, string | undefined]>
  orderedAwardQueueIds?: string[]
  currentBoutResultIdByBout?: Record<string, string>
  activeRepeatCallKeys?: Set<string>
}

export function isEventStillValid(
  event: AnnouncerEvent,
  ctx: ValidityContext,
): boolean {
  const payload = event.payload as Record<string, unknown>

  switch (event.type) {
    case 'BOUT_CALL': {
      const boutPayload = payload as BoutCallPayload
      if (boutPayload.repeatCorner) {
        if (!boutPayload.repeatEntryId) return false
        const key = `${boutPayload.boutId}:${boutPayload.repeatEntryId}`
        return ctx.activeRepeatCallKeys?.has(key) ?? false
      }
      const queue = ctx.boutQueueByMat?.[boutPayload.matIndex]
      return queue?.[0] === boutPayload.boutId
    }
    case 'BOUT_PREPARE': {
      const boutPayload = payload as BoutCallPayload
      const queue = ctx.boutQueueByMat?.[boutPayload.matIndex]
      return queue?.[1] === boutPayload.boutId
    }
    case 'BOUT_RESULT': {
      const resultPayload = payload as BoutResultPayload
      const currentId = ctx.currentBoutResultIdByBout?.[resultPayload.boutId]
      return currentId != null && currentId === resultPayload.boutResultId
    }
    case 'AWARD_CALL': {
      const awardPayload = payload as AwardCallPayload
      if (awardPayload.repeatPlacementId) return true
      if (awardPayload.repeatCategory) {
        return ctx.orderedAwardQueueIds?.includes(awardPayload.queueId) ?? false
      }
      return ctx.orderedAwardQueueIds?.[0] === awardPayload.queueId
    }
    case 'AWARD_PREPARE': {
      const awardPayload = payload as AwardCallPayload
      if (awardPayload.repeatCategory) {
        return ctx.orderedAwardQueueIds?.includes(awardPayload.queueId) ?? false
      }
      return ctx.orderedAwardQueueIds?.[1] === awardPayload.queueId
    }
    default:
      return false
  }
}

export function isBoutEventType(type: AnnouncerEventType): boolean {
  return type.startsWith('BOUT_')
}

/** Position-based auto announcements may extend TTL while still relevant. */
export function isPositionBasedAnnouncerEvent(event: AnnouncerEvent): boolean {
  const payload = event.payload as Record<string, unknown>
  if (
    payload.repeatCorner ||
    payload.repeatCategory ||
    payload.repeatPlacementId ||
    payload.repeatLogicalKey
  ) {
    return false
  }
  if (
    event.dedupeKey.startsWith('manual:') ||
    event.dedupeKey.startsWith('BOUT_REPEAT:') ||
    event.dedupeKey.startsWith('AWARD_REPEAT:')
  ) {
    return false
  }
  return true
}
