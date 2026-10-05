import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import type { AnnouncerEventType, Prisma } from '@prisma/client'
import { buildAnnouncementText } from './text/buildText'
import { normalizeAnnouncerText } from './text/normalize'
import { getRuleForType } from './rules'
import { getAnnouncerSettings } from './settings'

type Tx = Prisma.TransactionClient

export async function syncPosition(input: {
  scopeId: string
  scopeKey: string
  newPositionId: string | null
  eventType: AnnouncerEventType
  payloadBuilder: (positionId: string) => unknown
  sourceId?: string | null
  tx?: Tx
}): Promise<void> {
  const run = async (tx: Tx) => {
    await tx.$executeRaw`
      INSERT INTO "AnnouncerPositionState" ("tournamentScopeId", "scopeKey", "currentPositionId", "positionEpoch", "updatedAt")
      VALUES (${input.scopeId}, ${input.scopeKey}, NULL, 0, NOW())
      ON CONFLICT ("tournamentScopeId", "scopeKey") DO NOTHING
    `

    const rows = await tx.$queryRaw<
      Array<{ currentPositionId: string | null; positionEpoch: number }>
    >`
      SELECT "currentPositionId", "positionEpoch"
      FROM "AnnouncerPositionState"
      WHERE "tournamentScopeId" = ${input.scopeId} AND "scopeKey" = ${input.scopeKey}
      FOR UPDATE
    `
    const state = rows[0]
    if (!state) return

    if (input.newPositionId === state.currentPositionId) return

    const epoch = state.positionEpoch + 1
    await tx.announcerPositionState.update({
      where: {
        tournamentScopeId_scopeKey: {
          tournamentScopeId: input.scopeId,
          scopeKey: input.scopeKey,
        },
      },
      data: { currentPositionId: input.newPositionId, positionEpoch: epoch },
    })

    if (input.newPositionId == null) return

    const rule = await tx.announcerRule.findUnique({
      where: {
        tournamentScopeId_eventType: {
          tournamentScopeId: input.scopeId,
          eventType: input.eventType,
        },
      },
    })
    if (!rule?.enabled) return

    const settings = await tx.announcerSetting.findUnique({
      where: { tournamentScopeId: input.scopeId },
    })
    if (!settings?.enabled) return

    const payload = input.payloadBuilder(input.newPositionId)
    const textSnapshot = buildAnnouncementText(input.eventType, payload, rule)
    const dedupeKey = `${input.eventType}:${input.scopeKey}:${input.newPositionId}:e${epoch}`
    const expiresAt = new Date(Date.now() + rule.ttlSeconds * 1000)

    await tx.announcerEvent.create({
      data: {
        tournamentScopeId: input.scopeId,
        type: input.eventType,
        priority: rule.priority,
        sourceId: input.sourceId ?? input.newPositionId,
        dedupeKey,
        payload: payload as Prisma.InputJsonValue,
        textSnapshot,
        status: 'QUEUED',
        expiresAt,
      },
    })
  }

  if (input.tx) return run(input.tx)
  return prisma.$transaction(run)
}

export async function createResultEvent(input: {
  scopeId: string
  eventType: 'BOUT_RESULT'
  dedupeKey: string
  payload: unknown
  sourceId: string
  tx?: Tx
}): Promise<void> {
  const run = async (tx: Tx) => {
    const settings = await tx.announcerSetting.findUnique({
      where: { tournamentScopeId: input.scopeId },
    })
    if (!settings?.enabled) return

    const rule = await tx.announcerRule.findUnique({
      where: {
        tournamentScopeId_eventType: {
          tournamentScopeId: input.scopeId,
          eventType: input.eventType,
        },
      },
    })
    if (!rule?.enabled) return

    const existing = await tx.announcerEvent.findUnique({
      where: {
        tournamentScopeId_dedupeKey: {
          tournamentScopeId: input.scopeId,
          dedupeKey: input.dedupeKey,
        },
      },
    })
    if (existing) return

    const textSnapshot = buildAnnouncementText(input.eventType, input.payload, rule)
    await tx.announcerEvent.create({
      data: {
        tournamentScopeId: input.scopeId,
        type: input.eventType,
        priority: rule.priority,
        sourceId: input.sourceId,
        dedupeKey: input.dedupeKey,
        payload: input.payload as Prisma.InputJsonValue,
        textSnapshot,
        status: 'QUEUED',
        expiresAt: new Date(Date.now() + rule.ttlSeconds * 1000),
      },
    })
  }

  if (input.tx) return run(input.tx)
  return prisma.$transaction(run)
}

export async function createManualRepeatEvent(input: {
  scopeId: string
  sourceEventId: string
}): Promise<string> {
  const source = await prisma.announcerEvent.findUniqueOrThrow({
    where: { id: input.sourceEventId },
  })
  const rule = await getRuleForType(source.type, input.scopeId)
  const settings = await getAnnouncerSettings(input.scopeId)
  const { buildTtsSignature } = await import('./tts/signature')
  const textSnapshot = normalizeAnnouncerText(
    buildAnnouncementText(source.type, source.payload, rule) || source.textSnapshot || '',
  )
  const sameText = textSnapshot === source.textSnapshot
  const sameTts = source.generationTtsSignature === buildTtsSignature(settings, rule)
  const reuseAudio = sameText && sameTts && Boolean(source.audioCacheKey)
  const dedupeKey = `manual:${randomUUID()}`
  const created = await prisma.announcerEvent.create({
    data: {
      tournamentScopeId: input.scopeId,
      type: source.type,
      priority: rule.priority + 1,
      sourceId: source.sourceId,
      dedupeKey,
      payload: source.payload as Prisma.InputJsonValue,
      textSnapshot,
      status: reuseAudio ? 'READY' : 'QUEUED',
      audioCacheKey: reuseAudio ? source.audioCacheKey : null,
      audioDurationMs: reuseAudio ? source.audioDurationMs : null,
      generationTtsSignature: reuseAudio ? source.generationTtsSignature : null,
      ttsProviderUsed: reuseAudio ? source.ttsProviderUsed : null,
      ttsVoiceIdUsed: reuseAudio ? source.ttsVoiceIdUsed : null,
      expiresAt: new Date(Date.now() + rule.ttlSeconds * 1000),
    },
  })
  return created.id
}
