import { z } from 'zod'
import { listTtsProviderIds } from './tts/registry'

const ttsProviderIds = listTtsProviderIds() as [string, ...string[]]

export const ttsProviderSchema = z.enum(ttsProviderIds).nullable()

export const announcementGapMsSchema = z.number().int().min(0).max(15_000)
export const cueToSpeechGapMsSchema = z.number().int().min(0).max(3_000)
export const cueVolumeSchema = z.number().min(0).max(1)
export const speechRateSchema = z.number().min(0.7).max(1.3)

export const AnnouncerSettingsPatchSchema = z
  .object({
    mode: z.enum(['AUTO', 'MANUAL', 'PAUSED']).optional(),
    primaryProvider: z.string().min(1).optional(),
    primaryVoiceId: z.string().nullable().optional(),
    fallbackProvider1: z.string().nullable().optional(),
    fallbackVoiceId1: z.string().nullable().optional(),
    fallbackProvider2: z.string().nullable().optional(),
    fallbackVoiceId2: z.string().nullable().optional(),
    speechRate: speechRateSchema.optional(),
    announcementGapMs: announcementGapMsSchema.optional(),
    cueToSpeechGapMs: cueToSpeechGapMsSchema.optional(),
    boutCueSoundId: z.string().min(1).optional(),
    awardCueSoundId: z.string().min(1).optional(),
    cueVolume: cueVolumeSchema.optional(),
  })
  .strict()

export const AnnouncerRulePatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    nameFormat: z.enum(['LAST_FIRST', 'LAST_FIRST_MIDDLE']).optional(),
    includeMat: z.boolean().optional(),
    includeCategory: z.boolean().optional(),
    includeCorner: z.boolean().optional(),
    includeClub: z.boolean().optional(),
    includeCity: z.boolean().optional(),
    includeMethod: z.boolean().optional(),
    includePlacement: z.boolean().optional(),
    includeAge: z.boolean().optional(),
    includeWeight: z.boolean().optional(),
    includeCueSound: z.boolean().optional(),
    cueSoundId: z.union([z.string().min(1), z.null()]).optional(),
    ttlSeconds: z.number().int().min(10).max(3600).optional(),
    ttsProvider: ttsProviderSchema.optional(),
    ttsVoiceId: z.string().nullable().optional(),
  })
  .strict()

export const RulesReorderSchema = z.object({
  orderedEventTypes: z.array(
    z.enum(['BOUT_CALL', 'BOUT_PREPARE', 'BOUT_RESULT', 'AWARD_CALL', 'AWARD_PREPARE']),
  ),
})

export const SynthesizeTestSchema = z.object({
  text: z.string().min(1).max(5000),
  provider: z.string().optional(),
  voiceId: z.string().optional(),
  speechRate: speechRateSchema.optional(),
})

export const CompleteEventSchema = z.object({
  claimToken: z.string().min(1),
})

export const HeartbeatSchema = z.object({
  claimToken: z.string().min(1),
})
