import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import type { AnnouncerEvent, AnnouncerSetting } from '@prisma/client'
import { resolveCueForEventAsync } from './cuesServer'
import { selectReadyCandidate } from './queue'
import { getAnnouncerSettings } from './settings'
import type { ClaimPlaybackCode, PlaybackSnapshot } from './types'
import { expireAnnouncerEvent, expireEventData } from './expireEvents'
import { isEventStillValid } from './validity'
import { buildValidityContext } from './validityContext'

const PLAYING_LEASE_BUFFER_MS = 25_000
const PLAYING_LEASE_FALLBACK_MS = 90_000
const HEARTBEAT_EXTENSION_MS = 30_000
const READY_CANDIDATE_LIMIT = 25

export function computePlaybackLeaseUntil(
  settings: AnnouncerSetting,
  event: AnnouncerEvent,
  cueDurationMs: number,
): Date {
  const speechMs = event.audioDurationMs ?? PLAYING_LEASE_FALLBACK_MS
  const total =
    cueDurationMs + settings.cueToSpeechGapMs + speechMs + PLAYING_LEASE_BUFFER_MS
  return new Date(Date.now() + total)
}

export async function claimForPlayback(input: {
  scopeId: string
  eventId?: string
  requireAuto?: boolean
}): Promise<{ ok: true; snapshot: PlaybackSnapshot } | { ok: false; code: ClaimPlaybackCode }> {
  const settings = await getAnnouncerSettings(input.scopeId)
  if (!settings.enabled) return { ok: false, code: 'DISABLED' }
  if (input.requireAuto && settings.mode !== 'AUTO') {
    return { ok: false, code: 'MODE_NOT_AUTO' }
  }
  const manualPlay = Boolean(input.eventId)
  if (
    !manualPlay &&
    settings.nextPlaybackAllowedAt &&
    settings.nextPlaybackAllowedAt > new Date()
  ) {
    return { ok: false, code: 'GAP_ACTIVE' }
  }

  const playing = await prisma.announcerEvent.findFirst({
    where: { tournamentScopeId: input.scopeId, status: 'PLAYING' },
  })
  if (playing) return { ok: false, code: 'ALREADY_PLAYING' }

  const validityCtx = await buildValidityContext(input.scopeId)
  const claimToken = randomUUID()

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT 1 FROM "AnnouncerSetting"
      WHERE "tournamentScopeId" = ${input.scopeId}
      FOR UPDATE
    `

    const playingAgain = await tx.announcerEvent.findFirst({
      where: { tournamentScopeId: input.scopeId, status: 'PLAYING' },
    })
    if (playingAgain) return null

    let target: AnnouncerEvent | null = null
    let expiredIds: string[] = []

    if (input.eventId) {
      target = await tx.announcerEvent.findFirst({
        where: {
          id: input.eventId,
          tournamentScopeId: input.scopeId,
          status: 'READY',
        },
      })
      if (target && !isEventStillValid(target, validityCtx)) {
        await tx.announcerEvent.updateMany({
          where: { id: target.id, status: 'READY' },
          data: expireEventData(),
        })
        return { expiredOnly: true as const }
      }
    } else {
      const candidates = await tx.announcerEvent.findMany({
        where: {
          tournamentScopeId: input.scopeId,
          status: 'READY',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: READY_CANDIDATE_LIMIT,
      })
      const picked = selectReadyCandidate(candidates, validityCtx)
      target = picked.target
      expiredIds = picked.expiredIds
      if (expiredIds.length > 0) {
        await tx.announcerEvent.updateMany({
          where: { id: { in: expiredIds }, status: 'READY' },
          data: expireEventData(),
        })
      }
    }

    if (!target || !target.audioCacheKey) return null

    const rule = await tx.announcerRule.findUnique({
      where: {
        tournamentScopeId_eventType: {
          tournamentScopeId: input.scopeId,
          eventType: target.type,
        },
      },
    })
    if (!rule) return null

    const cue = await resolveCueForEventAsync(target.type, settings, rule)
    const leaseUntil = computePlaybackLeaseUntil(settings, target, cue?.durationMs ?? 0)

    const updated = await tx.announcerEvent.updateMany({
      where: { id: target.id, status: 'READY', tournamentScopeId: input.scopeId },
      data: {
        status: 'PLAYING',
        claimToken,
        claimedAt: new Date(),
        leaseUntil,
      },
    })
    if (updated.count !== 1) return null

    return { target, cue, leaseUntil }
  })

  if (result && 'expiredOnly' in result) {
    return { ok: false, code: input.eventId ? 'CLAIM_LOST' : 'NO_EVENT' }
  }
  if (!result) return { ok: false, code: input.eventId ? 'CLAIM_LOST' : 'NO_EVENT' }

  const speechUrl = `/api/admin/announcer/audio/${result.target.audioCacheKey}`
  return {
    ok: true,
    snapshot: {
      eventId: result.target.id,
      claimToken,
      leaseUntil: result.leaseUntil.toISOString(),
      cueToSpeechGapMs: settings.cueToSpeechGapMs,
      cueVolume: settings.cueVolume,
      cue: result.cue,
      speech: { url: speechUrl, durationMs: result.target.audioDurationMs },
      textSnapshot: result.target.textSnapshot,
    },
  }
}

export async function releasePlayback(input: {
  scopeId: string
  eventId: string
  claimToken: string
}): Promise<boolean> {
  const result = await prisma.announcerEvent.updateMany({
    where: {
      id: input.eventId,
      tournamentScopeId: input.scopeId,
      status: 'PLAYING',
      claimToken: input.claimToken,
    },
    data: {
      status: 'READY',
      claimToken: null,
      claimedAt: null,
      leaseUntil: null,
    },
  })
  return result.count === 1
}

export async function completePlayback(input: {
  scopeId: string
  eventId: string
  claimToken: string
}): Promise<boolean> {
  const settings = await getAnnouncerSettings(input.scopeId)
  const updated = await prisma.$transaction(async (tx) => {
    const count = await tx.announcerEvent.updateMany({
      where: {
        id: input.eventId,
        tournamentScopeId: input.scopeId,
        status: 'PLAYING',
        claimToken: input.claimToken,
      },
      data: {
        status: 'PLAYED',
        playedAt: new Date(),
        claimToken: null,
        claimedAt: null,
        leaseUntil: null,
      },
    })
    if (count.count !== 1) return false

    await tx.announcerSetting.update({
      where: { tournamentScopeId: input.scopeId },
      data: {
        nextPlaybackAllowedAt: new Date(Date.now() + settings.announcementGapMs),
      },
    })
    return true
  })
  return updated
}

export async function heartbeatPlayback(input: {
  scopeId: string
  eventId: string
  claimToken: string
}): Promise<boolean> {
  const event = await prisma.announcerEvent.findFirst({
    where: {
      id: input.eventId,
      tournamentScopeId: input.scopeId,
      status: 'PLAYING',
      claimToken: input.claimToken,
    },
  })
  if (!event?.leaseUntil) return false

  const validityCtx = await buildValidityContext(input.scopeId)
  if (!isEventStillValid(event, validityCtx)) {
    await expireAnnouncerEvent(event)
    return false
  }

  const extendUntil = new Date(
    Math.max(event.leaseUntil.getTime(), Date.now() + HEARTBEAT_EXTENSION_MS),
  )
  const result = await prisma.announcerEvent.updateMany({
    where: {
      id: input.eventId,
      tournamentScopeId: input.scopeId,
      status: 'PLAYING',
      claimToken: input.claimToken,
    },
    data: { leaseUntil: extendUntil },
  })
  return result.count === 1
}
