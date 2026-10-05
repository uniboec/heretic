import { randomUUID } from 'crypto'
import type { AnnouncerEvent, AwardCeremonyPlacement } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { prisma } from '@/lib/prisma'
import { buildAnnouncementText } from '../text/buildText'
import { getRuleForType } from '../rules'
import { isAnnouncerEnabled } from '../settings'
import { AWARD_REPEAT_CALL_PRIORITY, type AwardCallPayload, type AwardPlacementPayload } from '../types'

const REPEAT_EVENT_TTL_SECONDS = 120

const PENDING_REPEAT_STATUSES = ['QUEUED', 'GENERATING', 'READY', 'PLAYING'] as const

export type AwardRepeatCallKind = 'category_call' | 'category_prepare' | 'placement'

export type AwardRepeatCallResult = {
  eventId: string
  alreadyQueued: boolean
}

export function buildAwardRepeatLogicalKey(input: {
  kind: AwardRepeatCallKind
  queueId: string
  placementId?: string
}): string {
  return `AWARD_REPEAT:${input.kind}:${input.queueId}:${input.placementId ?? 'all'}`
}

export async function findPendingAwardRepeatCall(input: {
  scopeId: string
  kind: AwardRepeatCallKind
  queueId: string
  placementId?: string
}): Promise<AnnouncerEvent | null> {
  const logicalKey = buildAwardRepeatLogicalKey(input)

  return prisma.announcerEvent.findFirst({
    where: {
      tournamentScopeId: input.scopeId,
      status: { in: [...PENDING_REPEAT_STATUSES] },
      payload: {
        path: ['repeatLogicalKey'],
        equals: logicalKey,
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export class AwardAnnouncerCallError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'AwardAnnouncerCallError'
  }
}

function mapPlacement(row: AwardCeremonyPlacement): AwardPlacementPayload {
  return {
    placement: row.placement,
    displayName: `${row.lastName} ${row.firstName}${row.middleName ? ` ${row.middleName}` : ''}`.trim(),
    clubName: row.clubName,
    placementId: row.id,
  }
}

export async function enqueueAwardRepeatCall(input: {
  queueId: string
  kind: AwardRepeatCallKind
  placementId?: string
  scopeId?: string
}): Promise<AwardRepeatCallResult> {
  const scopeId = input.scopeId ?? TOURNAMENT_SCOPE_ID
  if (!(await isAnnouncerEnabled(scopeId))) {
    throw new AwardAnnouncerCallError(
      'Информатор выключен. Запустите его в разделе «Голосовой информатор».',
      'ANNOUNCER_DISABLED',
    )
  }

  const row = await prisma.awardCeremonyQueue.findUnique({
    where: { id: input.queueId },
    include: { placements: true },
  })
  if (!row) {
    throw new AwardAnnouncerCallError('Категория награждения не найдена', 'QUEUE_NOT_FOUND')
  }
  const categoryActive = row.status === 'PENDING' || row.status === 'IN_PROGRESS'
  const placementRecallAllowed = categoryActive || row.status === 'COMPLETED'
  if (input.kind === 'placement') {
    if (!placementRecallAllowed) {
      throw new AwardAnnouncerCallError(
        'Повторный вызов медалиста недоступен для этой категории',
        'CATEGORY_NOT_ACTIVE',
      )
    }
  } else if (!categoryActive) {
    throw new AwardAnnouncerCallError(
      'Повторный вызов категории доступен только для очереди награждения',
      'CATEGORY_NOT_ACTIVE',
    )
  }

  const eventType = input.kind === 'category_prepare' ? 'AWARD_PREPARE' : 'AWARD_CALL'
  const rule = await getRuleForType(eventType, scopeId)
  if (!rule.enabled) {
    throw new AwardAnnouncerCallError(
      'Объявления этого типа отключены в настройках информатора',
      'RULE_DISABLED',
    )
  }

  const placements = row.placements.map(mapPlacement)
  const base: AwardCallPayload = {
    queueId: row.id,
    categoryTitle: getCategoryTitleFromKey(row.categoryKey),
    placements,
  }

  const logicalKey = buildAwardRepeatLogicalKey({
    kind: input.kind,
    queueId: row.id,
    placementId: input.placementId,
  })

  let payload: AwardCallPayload
  let sourceId = row.id

  if (input.kind === 'placement') {
    if (!input.placementId) {
      throw new AwardAnnouncerCallError('Не указан медалист', 'PLACEMENT_REQUIRED')
    }
    const placement = row.placements.find((item) => item.id === input.placementId)
    if (!placement) {
      throw new AwardAnnouncerCallError('Медалист не найден в категории', 'PLACEMENT_NOT_FOUND')
    }
    const repeatPlacement = mapPlacement(placement)
    payload = {
      ...base,
      repeatPlacementId: placement.id,
      repeatPlacement,
      repeatLogicalKey: logicalKey,
    }
    sourceId = placement.id
  } else {
    payload = { ...base, repeatCategory: true, repeatLogicalKey: logicalKey }
  }

  const pending = await findPendingAwardRepeatCall({
    scopeId,
    kind: input.kind,
    queueId: row.id,
    placementId: input.placementId,
  })
  if (pending) {
    return { eventId: pending.id, alreadyQueued: true }
  }

  const dedupeKey = `${logicalKey}:${randomUUID()}`
  const textSnapshot = buildAnnouncementText(eventType, payload, rule)

  const event = await prisma.announcerEvent.create({
    data: {
      tournamentScopeId: scopeId,
      type: eventType,
      priority: AWARD_REPEAT_CALL_PRIORITY,
      sourceId,
      dedupeKey,
      payload,
      textSnapshot,
      status: 'QUEUED',
      expiresAt: new Date(Date.now() + REPEAT_EVENT_TTL_SECONDS * 1000),
    },
  })

  const { kickAnnouncerWorker } = await import('../worker')
  kickAnnouncerWorker(scopeId)

  return { eventId: event.id, alreadyQueued: false }
}
