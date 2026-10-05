import { randomUUID } from 'crypto'
import type { AnnouncerEventType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureAnnouncerRules } from '@/lib/announcer/rules'
import { ensureAnnouncerSettings } from '@/lib/announcer/settings'
import { buildTtsSignature } from '@/lib/announcer/tts/signature'

export async function buildFinalizePayloadForEvent(input: {
  scopeId: string
  eventType: AnnouncerEventType
  eventId: string
  generationToken: string
  audioCacheKey: string
  textSnapshot: string
  audioDurationMs?: number
  generationTtsSignature?: string | null
  providerUsed?: string
  voiceIdUsed?: string
}) {
  const settings = await prisma.announcerSetting.findUniqueOrThrow({
    where: { tournamentScopeId: input.scopeId },
  })
  const rule = await prisma.announcerRule.findUniqueOrThrow({
    where: {
      tournamentScopeId_eventType: {
        tournamentScopeId: input.scopeId,
        eventType: input.eventType,
      },
    },
  })
  const signature =
    input.generationTtsSignature === undefined
      ? buildTtsSignature(settings, rule)
      : input.generationTtsSignature

  return {
    eventId: input.eventId,
    generationToken: input.generationToken,
    generationTtsSignature: signature ?? '',
    tournamentScopeId: input.scopeId,
    eventType: input.eventType,
    audioCacheKey: input.audioCacheKey,
    audioDurationMs: input.audioDurationMs ?? 1200,
    textSnapshot: input.textSnapshot,
    providerUsed: input.providerUsed ?? rule.ttsProvider ?? settings.primaryProvider,
    voiceIdUsed: input.voiceIdUsed ?? rule.ttsVoiceId ?? settings.primaryVoiceId ?? 'marina',
  }
}

export async function purgeAnnouncerIntegrationState(scopeId: string): Promise<void> {
  await prisma.announcerEvent.deleteMany({ where: { tournamentScopeId: scopeId } })
  await prisma.announcerPositionState.deleteMany({ where: { tournamentScopeId: scopeId } })
  await prisma.announcerAudioCache.deleteMany()
  await prisma.announcerPronunciation.deleteMany({ where: { tournamentScopeId: scopeId } })
  await ensureAnnouncerSettings(scopeId)
  await ensureAnnouncerRules(scopeId)
  await prisma.announcerRule.updateMany({
    where: { tournamentScopeId: scopeId },
    data: { ttsProvider: null, ttsVoiceId: null },
  })
  await prisma.announcerSetting.update({
    where: { tournamentScopeId: scopeId },
    data: { enabled: false, nextPlaybackAllowedAt: null, announcementGapMs: 100 },
  })
}

export async function enableAnnouncerForTests(
  scopeId: string,
  patch?: { announcementGapMs?: number },
): Promise<void> {
  await ensureAnnouncerSettings(scopeId)
  await ensureAnnouncerRules(scopeId)
  await prisma.announcerSetting.update({
    where: { tournamentScopeId: scopeId },
    data: {
      enabled: true,
      mode: 'AUTO',
      nextPlaybackAllowedAt: null,
      announcementGapMs: patch?.announcementGapMs ?? 100,
    },
  })
}

export async function createReadyAnnouncerEvent(input: {
  scopeId: string
  priority: number
  type?: AnnouncerEventType
  createdAt?: Date
  audioDurationMs?: number
  includeCueRule?: boolean
}): Promise<{ id: string }> {
  const type = input.type ?? 'BOUT_CALL'
  await ensureAnnouncerRules(input.scopeId)
  if (input.includeCueRule) {
    await prisma.announcerRule.update({
      where: {
        tournamentScopeId_eventType: {
          tournamentScopeId: input.scopeId,
          eventType: type,
        },
      },
      data: { includeCueSound: true },
    })
  }

  const event = await prisma.announcerEvent.create({
    data: {
      tournamentScopeId: input.scopeId,
      type,
      priority: input.priority,
      sourceId: randomUUID(),
      dedupeKey: randomUUID(),
      payload: { test: true },
      textSnapshot: `test announcement ${input.priority}`,
      status: 'READY',
      audioCacheKey: `cache-${randomUUID()}`,
      audioDurationMs: input.audioDurationMs ?? 5000,
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: input.createdAt,
    },
  })
  return { id: event.id }
}
