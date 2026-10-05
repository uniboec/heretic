import type { AnnouncerEvent } from '@prisma/client'
import { isEventStillValid, type ValidityContext } from './validity'

export function selectReadyCandidate(
  candidates: AnnouncerEvent[],
  ctx: ValidityContext,
): { target: AnnouncerEvent | null; expiredIds: string[] } {
  const expiredIds: string[] = []

  for (const candidate of candidates) {
    if (!candidate.audioCacheKey) continue
    if (!isEventStillValid(candidate, ctx)) {
      expiredIds.push(candidate.id)
      continue
    }
    return { target: candidate, expiredIds }
  }

  return { target: null, expiredIds }
}
