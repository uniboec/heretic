import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'
import type { ValidityContext } from './validity'
import { isEventStillValid } from './validity'
import { buildValidityContext } from './validityContext'
import { expireAnnouncerEvent, expireEventData, expireStaleAnnouncerEvents } from './expireEvents'
import { tickBoutRepeatCalls } from './hooks/repeatCall'
import { claimNextQueuedForGeneration, processGeneratingEvent } from './processor'

const POLL_MS = 750

export async function reclaimExpiredGenerationLeases(
  scopeId: string,
  ctx?: ValidityContext,
): Promise<void> {
  const stale = await prisma.announcerEvent.findMany({
    where: {
      tournamentScopeId: scopeId,
      status: 'GENERATING',
      generationLeaseUntil: { lt: new Date() },
    },
  })

  for (const event of stale) {
    const stillValid = ctx
      ? isEventStillValid(event, ctx)
      : !event.expiresAt || event.expiresAt > new Date()
    await prisma.announcerEvent.updateMany({
      where: { id: event.id, status: 'GENERATING' },
      data: stillValid
        ? {
            status: 'QUEUED',
            generationToken: null,
            generationStartedAt: null,
            generationLeaseUntil: null,
            generationTtsSignature: null,
          }
        : expireEventData(),
    })
  }
}

async function reclaimExpiredPlayLeases(scopeId: string, ctx: ValidityContext): Promise<void> {
  const stale = await prisma.announcerEvent.findMany({
    where: {
      tournamentScopeId: scopeId,
      status: 'PLAYING',
      leaseUntil: { lt: new Date() },
    },
  })

  for (const event of stale) {
    const valid = isEventStillValid(event, ctx)
    await prisma.announcerEvent.updateMany({
      where: { id: event.id, status: 'PLAYING' },
      data: valid
        ? {
            status: 'READY',
            claimToken: null,
            claimedAt: null,
            leaseUntil: null,
          }
        : expireEventData(),
    })
  }
}

export function kickAnnouncerWorker(scopeId = TOURNAMENT_SCOPE_ID): void {
  void runAnnouncerWorkerTick(scopeId).catch((error) => {
    console.error('[announcer-worker] background tick error', error)
  })
}

export async function runAnnouncerWorkerTick(scopeId = TOURNAMENT_SCOPE_ID): Promise<void> {
  const settings = await prisma.announcerSetting.findUnique({
    where: { tournamentScopeId: scopeId },
  })
  if (!settings?.enabled) return

  const ctx = await buildValidityContext(scopeId)

  await expireStaleAnnouncerEvents(scopeId, ctx)
  await reclaimExpiredGenerationLeases(scopeId, ctx)
  await reclaimExpiredPlayLeases(scopeId, ctx)
  await tickBoutRepeatCalls(scopeId)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const claimed = await claimNextQueuedForGeneration(scopeId)
    if (!claimed) break

    if (!isEventStillValid(claimed, ctx)) {
      await expireAnnouncerEvent(claimed)
      continue
    }

    try {
      await processGeneratingEvent(claimed)
    } catch (error) {
      await prisma.announcerEvent.updateMany({
        where: { id: claimed.id, status: 'GENERATING', generationToken: claimed.generationToken },
        data: {
          status: 'FAILED',
          failureReason: error instanceof Error ? error.message : 'TTS failed',
          generationToken: null,
          generationStartedAt: null,
          generationLeaseUntil: null,
          generationTtsSignature: null,
        },
      })
    }
    break
  }
}

export async function startAnnouncerWorkerLoop(scopeId = TOURNAMENT_SCOPE_ID): Promise<void> {
  for (;;) {
    try {
      await runAnnouncerWorkerTick(scopeId)
    } catch (error) {
      console.error('[announcer-worker] tick error', error)
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}
