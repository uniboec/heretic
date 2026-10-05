import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'
import type { AnnouncerEventType, AnnouncerRule } from '@prisma/client'
import { DEFAULT_PRIORITIES, DEFAULT_TTL_SECONDS } from './types'
import { propagateRuleChange } from './rulePropagation'

const RULE_DEFAULTS: Record<
  AnnouncerEventType,
  Partial<{
    includeCorner: boolean
    includeCueSound: boolean
    includeClub: boolean
    includeCity: boolean
    includeMethod: boolean
    includePlacement: boolean
    includeCategory: boolean
  }>
> = {
  BOUT_CALL: { includeCorner: true, includeCueSound: true, includeClub: true, includeCity: true },
  BOUT_PREPARE: { includeCorner: false, includeCueSound: false, includeClub: true },
  BOUT_RESULT: { includeCorner: true, includeMethod: true, includeClub: true, includeCity: true },
  AWARD_CALL: {
    includeCueSound: true,
    includePlacement: true,
    includeClub: true,
    includeCity: true,
  },
  AWARD_PREPARE: { includeClub: true, includePlacement: false, includeCategory: true },
}

const VOICE_DEFAULTS: Partial<
  Record<AnnouncerEventType, { ttsProvider: string; ttsVoiceId: string }>
> = {
  BOUT_CALL: { ttsProvider: 'azure', ttsVoiceId: 'ru-RU-DmitryNeural' },
  BOUT_PREPARE: { ttsProvider: 'azure', ttsVoiceId: 'ru-RU-DmitryNeural' },
  BOUT_RESULT: { ttsProvider: 'azure', ttsVoiceId: 'ru-RU-DmitryNeural' },
  AWARD_CALL: { ttsProvider: 'azure', ttsVoiceId: 'ru-RU-SvetlanaNeural' },
  AWARD_PREPARE: { ttsProvider: 'azure', ttsVoiceId: 'ru-RU-SvetlanaNeural' },
}

const EVENT_TYPES: AnnouncerEventType[] = [
  'BOUT_CALL',
  'BOUT_PREPARE',
  'BOUT_RESULT',
  'AWARD_CALL',
  'AWARD_PREPARE',
]

export async function ensureAnnouncerRules(scopeId = TOURNAMENT_SCOPE_ID): Promise<AnnouncerRule[]> {
  const existing = await prisma.announcerRule.findMany({ where: { tournamentScopeId: scopeId } })
  if (existing.length === EVENT_TYPES.length) return existing

  for (const eventType of EVENT_TYPES) {
    const defaults = RULE_DEFAULTS[eventType]
    const voiceDefaults = VOICE_DEFAULTS[eventType]
    await prisma.announcerRule.upsert({
      where: { tournamentScopeId_eventType: { tournamentScopeId: scopeId, eventType } },
      create: {
        tournamentScopeId: scopeId,
        eventType,
        priority: DEFAULT_PRIORITIES[eventType],
        ttlSeconds: DEFAULT_TTL_SECONDS[eventType],
        ...defaults,
        ...voiceDefaults,
      },
      update: {},
    })
  }
  return prisma.announcerRule.findMany({
    where: { tournamentScopeId: scopeId },
    orderBy: { priority: 'desc' },
  })
}

export async function getAnnouncerRules(scopeId = TOURNAMENT_SCOPE_ID): Promise<AnnouncerRule[]> {
  return ensureAnnouncerRules(scopeId)
}

export async function getRuleForType(
  eventType: AnnouncerEventType,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<AnnouncerRule> {
  const rules = await ensureAnnouncerRules(scopeId)
  const rule = rules.find((r) => r.eventType === eventType)
  if (!rule) throw new Error(`Missing announcer rule: ${eventType}`)
  return rule
}

export async function updateAnnouncerRule(
  eventType: AnnouncerEventType,
  patch: Partial<AnnouncerRule>,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<AnnouncerRule> {
  await ensureAnnouncerRules(scopeId)
  return prisma.$transaction(async (tx) => {
    const existing = await tx.announcerRule.findUnique({
      where: { tournamentScopeId_eventType: { tournamentScopeId: scopeId, eventType } },
    })
    const normalizedPatch = { ...patch }
    if (
      'ttsProvider' in patch &&
      patch.ttsProvider !== undefined &&
      patch.ttsProvider !== existing?.ttsProvider
    ) {
      normalizedPatch.ttsVoiceId = null
    }

    const voiceChanged =
      ('ttsProvider' in normalizedPatch &&
        normalizedPatch.ttsProvider !== existing?.ttsProvider) ||
      ('ttsVoiceId' in normalizedPatch &&
        normalizedPatch.ttsVoiceId !== existing?.ttsVoiceId)

    const updated = await tx.announcerRule.update({
      where: { tournamentScopeId_eventType: { tournamentScopeId: scopeId, eventType } },
      data: normalizedPatch,
    })
    await propagateRuleChange(tx, updated, { voiceChanged })
    return updated
  })
}

export async function reorderAnnouncerRules(
  orderedEventTypes: AnnouncerEventType[],
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<AnnouncerRule[]> {
  const base = 100
  const step = 20
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedEventTypes.length; i++) {
      const priority = base - i * step
      const updated = await tx.announcerRule.update({
        where: {
          tournamentScopeId_eventType: { tournamentScopeId: scopeId, eventType: orderedEventTypes[i] },
        },
        data: { priority },
      })
      await propagateRuleChange(tx, updated)
    }
  })
  return getAnnouncerRules(scopeId)
}
