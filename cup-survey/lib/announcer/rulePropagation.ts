import type { AnnouncerRule, Prisma } from '@prisma/client'
import { buildTtsSignature } from './tts/signature'

type Tx = Prisma.TransactionClient

const VOICE_RESET_DATA = {
  audioCacheKey: null,
  audioDurationMs: null,
  generationTtsSignature: null,
  generationToken: null,
  generationStartedAt: null,
  generationLeaseUntil: null,
  ttsProviderUsed: null,
  ttsVoiceIdUsed: null,
  status: 'QUEUED' as const,
}

export async function invalidateEventsForVoiceChange(
  tx: Tx,
  rule: AnnouncerRule,
): Promise<void> {
  await tx.announcerEvent.updateMany({
    where: {
      tournamentScopeId: rule.tournamentScopeId,
      type: rule.eventType,
      status: { in: ['QUEUED', 'READY', 'GENERATING'] },
    },
    data: VOICE_RESET_DATA,
  })
}

export async function invalidateGlobalDefaultVoiceEvents(
  tx: Tx,
  scopeId: string,
): Promise<void> {
  const rules = await tx.announcerRule.findMany({
    where: { tournamentScopeId: scopeId, ttsProvider: null },
    select: { eventType: true },
  })
  if (rules.length === 0) return

  await tx.announcerEvent.updateMany({
    where: {
      tournamentScopeId: scopeId,
      type: { in: rules.map((rule) => rule.eventType) },
      status: { in: ['QUEUED', 'READY', 'GENERATING'] },
    },
    data: VOICE_RESET_DATA,
  })
}

export async function propagateRuleChange(
  tx: Tx,
  rule: AnnouncerRule,
  options?: { voiceChanged?: boolean },
): Promise<void> {
  if (options?.voiceChanged) {
    await invalidateEventsForVoiceChange(tx, rule)
  }

  if (rule.enabled) {
    await tx.announcerEvent.updateMany({
      where: {
        tournamentScopeId: rule.tournamentScopeId,
        type: rule.eventType,
        status: { in: ['QUEUED', 'READY'] },
      },
      data: { priority: rule.priority },
    })
    return
  }

  await tx.announcerEvent.updateMany({
    where: {
      tournamentScopeId: rule.tournamentScopeId,
      type: rule.eventType,
      status: { in: ['QUEUED', 'READY', 'GENERATING'] },
    },
    data: {
      status: 'SKIPPED',
      generationToken: null,
      generationStartedAt: null,
      generationLeaseUntil: null,
      generationTtsSignature: null,
    },
  })
}

export async function finalizeAfterGeneration(
  tx: Tx,
  input: {
    eventId: string
    generationToken: string
    generationTtsSignature: string
    tournamentScopeId: string
    eventType: AnnouncerRule['eventType']
    audioCacheKey: string
    audioDurationMs: number
    textSnapshot: string
    providerUsed: string
    voiceIdUsed: string
  },
): Promise<'READY' | 'SKIPPED' | 'REQUEUED'> {
  const settings = await tx.announcerSetting.findUnique({
    where: { tournamentScopeId: input.tournamentScopeId },
  })
  const rule = await tx.announcerRule.findUnique({
    where: {
      tournamentScopeId_eventType: {
        tournamentScopeId: input.tournamentScopeId,
        eventType: input.eventType,
      },
    },
  })

  if (settings && rule && input.generationTtsSignature) {
    const currentSignature = buildTtsSignature(settings, rule)
    if (currentSignature !== input.generationTtsSignature) {
      await tx.announcerEvent.updateMany({
        where: {
          id: input.eventId,
          status: 'GENERATING',
          generationToken: input.generationToken,
        },
        data: VOICE_RESET_DATA,
      })
      return 'REQUEUED'
    }
  }

  const nextStatus =
    settings?.enabled && rule?.enabled ? ('READY' as const) : ('SKIPPED' as const)

  const updated = await tx.announcerEvent.updateMany({
    where: {
      id: input.eventId,
      status: 'GENERATING',
      generationToken: input.generationToken,
    },
    data: {
      status: nextStatus,
      generationToken: null,
      generationStartedAt: null,
      generationLeaseUntil: null,
      audioCacheKey: input.audioCacheKey,
      audioDurationMs: input.audioDurationMs,
      textSnapshot: input.textSnapshot,
      priority: rule?.priority ?? undefined,
      ttsProviderUsed: input.providerUsed,
      ttsVoiceIdUsed: input.voiceIdUsed,
    },
  })

  if (updated.count !== 1) return 'SKIPPED'
  return nextStatus
}
