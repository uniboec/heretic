import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'

import { prisma } from '@/lib/prisma'

import type { AnnouncerSetting } from '@prisma/client'

import type { z } from 'zod'

import { invalidateGlobalDefaultVoiceEvents } from './rulePropagation'

import type { AnnouncerSettingsPatchSchema } from './schemas'



type SettingsPatch = z.infer<typeof AnnouncerSettingsPatchSchema>



const TTS_SETTING_KEYS = [

  'primaryProvider',

  'primaryVoiceId',

  'fallbackProvider1',

  'fallbackVoiceId1',

  'fallbackProvider2',

  'fallbackVoiceId2',

  'speechRate',

] as const satisfies ReadonlyArray<keyof SettingsPatch>



const DEFAULT_SETTINGS = {

  tournamentScopeId: TOURNAMENT_SCOPE_ID,

  enabled: false,

  mode: 'AUTO' as const,

  primaryProvider: 'azure',

  primaryVoiceId: 'ru-RU-DmitryNeural',

  fallbackProvider1: 'yandex',

  fallbackVoiceId1: null,

  fallbackProvider2: null,

  fallbackVoiceId2: null,

  speechRate: 1,

  announcementGapMs: 3000,

  cueToSpeechGapMs: 700,

  nextPlaybackAllowedAt: null,

  boutCueSoundId: 'universfield-032',

  awardCueSoundId: 'chime-01',

  cueVolume: 0.7,

}



function globalTtsSettingsChanged(

  existing: AnnouncerSetting,

  patch: SettingsPatch,

): boolean {

  return TTS_SETTING_KEYS.some((key) => {

    if (!(key in patch)) return false

    return patch[key] !== existing[key]

  })

}



export async function ensureAnnouncerSettings(

  scopeId = TOURNAMENT_SCOPE_ID,

): Promise<AnnouncerSetting> {

  return prisma.announcerSetting.upsert({

    where: { tournamentScopeId: scopeId },

    create: { ...DEFAULT_SETTINGS, tournamentScopeId: scopeId },

    update: {},

  })

}



export async function getAnnouncerSettings(

  scopeId = TOURNAMENT_SCOPE_ID,

): Promise<AnnouncerSetting> {

  const row = await prisma.announcerSetting.findUnique({

    where: { tournamentScopeId: scopeId },

  })

  if (!row) return ensureAnnouncerSettings(scopeId)

  return row

}



export async function isAnnouncerEnabled(scopeId = TOURNAMENT_SCOPE_ID): Promise<boolean> {

  const settings = await getAnnouncerSettings(scopeId)

  return settings.enabled

}



export async function assertAnnouncerEnabled(scopeId = TOURNAMENT_SCOPE_ID): Promise<void> {

  if (!(await isAnnouncerEnabled(scopeId))) {

    throw new Error('Announcer is disabled')

  }

}



export async function updateAnnouncerSettings(

  patch: SettingsPatch,

  scopeId = TOURNAMENT_SCOPE_ID,

): Promise<AnnouncerSetting> {

  await ensureAnnouncerSettings(scopeId)

  const existing = await getAnnouncerSettings(scopeId)

  const voiceChanged = globalTtsSettingsChanged(existing, patch)



  return prisma.$transaction(async (tx) => {

    const updated = await tx.announcerSetting.update({

      where: { tournamentScopeId: scopeId },

      data: patch,

    })

    if (voiceChanged) {

      await invalidateGlobalDefaultVoiceEvents(tx, scopeId)

    }

    return updated

  })

}


