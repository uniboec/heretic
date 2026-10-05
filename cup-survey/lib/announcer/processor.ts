import { randomUUID } from 'crypto'

import { prisma } from '@/lib/prisma'

import type { AnnouncerEvent, AnnouncerEventType } from '@prisma/client'

import { finalizeAfterGeneration } from './rulePropagation'

import { getAnnouncerSettings } from './settings'

import { buildAnnouncementText } from './text/buildText'

import { normalizeAnnouncerText } from './text/normalize'

import { buildTtsSignature } from './tts/signature'

import { synthesizeForEvent } from './tts/synthesize'



const GENERATION_LEASE_MS = 90_000



function sleep(ms: number): Promise<void> {

  return new Promise((resolve) => setTimeout(resolve, ms))

}



async function resolveGenerationTtsSignature(

  tournamentScopeId: string,

  eventType: AnnouncerEventType,

): Promise<string> {

  const settings = await getAnnouncerSettings(tournamentScopeId)

  const rule = await prisma.announcerRule.findUnique({

    where: {

      tournamentScopeId_eventType: { tournamentScopeId, eventType },

    },

  })

  if (!rule) throw new Error(`Missing announcer rule: ${eventType}`)

  return buildTtsSignature(settings, rule)

}



export async function waitUntilEventAudioReady(

  eventId: string,

  options?: { maxAttempts?: number; delayMs?: number },

): Promise<boolean> {

  const maxAttempts = options?.maxAttempts ?? 30

  const delayMs = options?.delayMs ?? 500



  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {

    const event = await prisma.announcerEvent.findUnique({ where: { id: eventId } })

    if (!event) return false

    if (event.status === 'READY' && event.audioCacheKey) return true

    if (event.status === 'FAILED' || event.status === 'EXPIRED') return false

    if (event.status === 'QUEUED') {

      const ready = await generateAudioForQueuedEvent(eventId)

      if (ready) return true

    }

    await sleep(delayMs)

  }



  return false

}



export async function generateAudioForQueuedEvent(eventId: string): Promise<boolean> {

  const generationToken = randomUUID()

  const leaseUntil = new Date(Date.now() + GENERATION_LEASE_MS)



  const queued = await prisma.announcerEvent.findUnique({ where: { id: eventId } })

  if (!queued || queued.status !== 'QUEUED') {

    const existing = await prisma.announcerEvent.findUnique({ where: { id: eventId } })

    return existing?.status === 'READY' && Boolean(existing.audioCacheKey)

  }



  const generationTtsSignature = await resolveGenerationTtsSignature(

    queued.tournamentScopeId,

    queued.type,

  )



  const claimed = await prisma.announcerEvent.updateMany({

    where: { id: eventId, status: 'QUEUED' },

    data: {

      status: 'GENERATING',

      generationToken,

      generationStartedAt: new Date(),

      generationLeaseUntil: leaseUntil,

      generationTtsSignature,

    },

  })



  if (claimed.count !== 1) {

    const existing = await prisma.announcerEvent.findUnique({ where: { id: eventId } })

    return existing?.status === 'READY' && Boolean(existing.audioCacheKey)

  }



  const event = await prisma.announcerEvent.findUniqueOrThrow({ where: { id: eventId } })

  try {

    await processGeneratingEvent(event)

    const ready = await prisma.announcerEvent.findUnique({ where: { id: eventId } })

    return ready?.status === 'READY' && Boolean(ready.audioCacheKey)

  } catch (error) {

    await prisma.announcerEvent.updateMany({

      where: { id: eventId, status: 'GENERATING', generationToken },

      data: {

        status: 'FAILED',

        failureReason: error instanceof Error ? error.message : 'TTS failed',

        generationToken: null,

        generationStartedAt: null,

        generationLeaseUntil: null,

        generationTtsSignature: null,

      },

    })

    return false

  }

}



export async function claimNextQueuedForGeneration(

  scopeId: string,

): Promise<AnnouncerEvent | null> {

  const generationToken = randomUUID()

  const leaseUntil = new Date(Date.now() + GENERATION_LEASE_MS)



  const rows = await prisma.$queryRaw<AnnouncerEvent[]>`

    UPDATE "AnnouncerEvent" e

    SET status = 'GENERATING',

        "generationToken" = ${generationToken},

        "generationStartedAt" = NOW(),

        "generationLeaseUntil" = ${leaseUntil}

    WHERE e.id = (

      SELECT e2.id FROM "AnnouncerEvent" e2

      INNER JOIN "AnnouncerSetting" s

        ON s."tournamentScopeId" = e2."tournamentScopeId" AND s.enabled = true

      WHERE e2."tournamentScopeId" = ${scopeId}

        AND e2.status = 'QUEUED'

        AND (e2."expiresAt" IS NULL OR e2."expiresAt" > NOW())

      ORDER BY e2.priority DESC, e2."createdAt" ASC

      LIMIT 1

      FOR UPDATE OF e2 SKIP LOCKED

    )

    RETURNING e.*

  `

  const claimed = rows[0] ?? null

  if (!claimed) return null



  const generationTtsSignature = await resolveGenerationTtsSignature(

    claimed.tournamentScopeId,

    claimed.type,

  )

  await prisma.announcerEvent.update({

    where: { id: claimed.id },

    data: { generationTtsSignature },

  })



  return { ...claimed, generationTtsSignature }

}



export async function processGeneratingEvent(event: AnnouncerEvent): Promise<void> {

  const settings = await getAnnouncerSettings(event.tournamentScopeId)

  const rule = await prisma.announcerRule.findUnique({

    where: {

      tournamentScopeId_eventType: {

        tournamentScopeId: event.tournamentScopeId,

        eventType: event.type,

      },

    },

  })

  if (!rule) {
    if (event.generationToken) {
      await prisma.announcerEvent.updateMany({
        where: {
          id: event.id,
          status: 'GENERATING',
          generationToken: event.generationToken,
        },
        data: {
          status: 'FAILED',
          failureReason: `Missing announcer rule: ${event.type}`,
          generationToken: null,
          generationStartedAt: null,
          generationLeaseUntil: null,
          generationTtsSignature: null,
        },
      })
    }
    return
  }



  const { applyPronunciationDictionary } = await import('./pronunciation')

  const rawText =

    buildAnnouncementText(event.type, event.payload, rule) || event.textSnapshot || ''

  const text = normalizeAnnouncerText(

    await applyPronunciationDictionary(rawText, event.tournamentScopeId),

  )



  const generationTtsSignature =

    event.generationTtsSignature ??

    (await resolveGenerationTtsSignature(event.tournamentScopeId, event.type))



  const { cacheKey, durationMs, providerUsed, voiceIdUsed } = await synthesizeForEvent(

    settings,

    rule,

    text,

  )



  await prisma.$transaction(async (tx) => {

    if (!event.generationToken) return

    await finalizeAfterGeneration(tx, {

      eventId: event.id,

      generationToken: event.generationToken,

      generationTtsSignature,

      tournamentScopeId: event.tournamentScopeId,

      eventType: event.type,

      audioCacheKey: cacheKey,

      audioDurationMs: durationMs,

      textSnapshot: text,

      providerUsed,

      voiceIdUsed,

    })

  })

}


