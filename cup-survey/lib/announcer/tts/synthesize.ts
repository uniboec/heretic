import type { AnnouncerRule, AnnouncerSetting } from '@prisma/client'
import { defaultVoiceForProvider, getTtsProvider } from './registry'
import { ttsPairKey } from './signature'
import { buildCacheKey, readCachedAudio, writeCachedAudio } from './storage'
import type { TtsAudio } from './types'

export type SynthesisResult = {
  cacheKey: string
  mimeType: string
  durationMs: number
  providerUsed: string
  voiceIdUsed: string
}

function voiceForSlot(settings: AnnouncerSetting, providerId: string): string {
  if (providerId === settings.primaryProvider && settings.primaryVoiceId) {
    return settings.primaryVoiceId
  }
  if (providerId === settings.fallbackProvider1 && settings.fallbackVoiceId1) {
    return settings.fallbackVoiceId1
  }
  if (providerId === settings.fallbackProvider2 && settings.fallbackVoiceId2) {
    return settings.fallbackVoiceId2
  }
  return defaultVoiceForProvider(providerId)
}

function providerChain(settings: AnnouncerSetting): string[] {
  const chain = [
    settings.primaryProvider,
    settings.fallbackProvider1,
    settings.fallbackProvider2,
  ].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i)
  return chain
}

function estimateDurationMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(3000, Math.round((words / 2.5) * 1000))
}

async function synthesizeWithProvider(
  settings: AnnouncerSetting,
  text: string,
  providerId: string,
  voiceId: string,
): Promise<SynthesisResult> {
  const provider = getTtsProvider(providerId)
  if (!provider) throw new Error(`Unknown provider: ${providerId}`)

  const cacheKey = buildCacheKey({
    provider: providerId,
    voiceId,
    speechRate: settings.speechRate,
    text,
  })

  const cached = await readCachedAudio(cacheKey)
  if (cached) {
    return {
      cacheKey,
      mimeType: 'audio/mpeg',
      durationMs: estimateDurationMs(text),
      providerUsed: providerId,
      voiceIdUsed: voiceId,
    }
  }

  const audio = await provider.synthesize({
    text,
    voice: voiceId,
    rate: settings.speechRate,
  })
  await writeCachedAudio({
    cacheKey,
    provider: providerId,
    voiceId,
    speechRate: settings.speechRate,
    text,
    mimeType: audio.mimeType,
    buffer: audio.buffer,
  })
  return {
    cacheKey,
    mimeType: audio.mimeType,
    durationMs: audio.durationMs ?? estimateDurationMs(text),
    providerUsed: providerId,
    voiceIdUsed: voiceId,
  }
}

export async function synthesizeWithFallback(
  settings: AnnouncerSetting,
  text: string,
  excludePairs?: Set<string>,
): Promise<SynthesisResult> {
  const chain = providerChain(settings)
  let lastError: unknown

  for (const providerId of chain) {
    const voice = voiceForSlot(settings, providerId)
    if (excludePairs?.has(ttsPairKey(providerId, voice))) continue

    try {
      return await synthesizeWithProvider(settings, text, providerId, voice)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('No TTS provider available')
}

export async function synthesizeForEvent(
  settings: AnnouncerSetting,
  rule: AnnouncerRule,
  text: string,
): Promise<SynthesisResult> {
  if (!rule.ttsProvider) {
    return synthesizeWithFallback(settings, text)
  }

  const ruleVoice = rule.ttsVoiceId ?? defaultVoiceForProvider(rule.ttsProvider)
  const excludePairs = new Set([ttsPairKey(rule.ttsProvider, ruleVoice)])

  try {
    return await synthesizeWithProvider(settings, text, rule.ttsProvider, ruleVoice)
  } catch {
    return synthesizeWithFallback(settings, text, excludePairs)
  }
}

export async function synthesizeTest(
  input: {
    text: string
    provider?: string
    voiceId?: string
    speechRate?: number
  },
  settings: AnnouncerSetting,
): Promise<TtsAudio & { provider: string }> {
  const { applyPronunciationDictionary } = await import('../pronunciation')
  const { normalizeAnnouncerText } = await import('../text/normalize')
  const text = normalizeAnnouncerText(
    await applyPronunciationDictionary(input.text, settings.tournamentScopeId),
  )
  const rate = input.speechRate ?? settings.speechRate

  if (input.provider) {
    const provider = getTtsProvider(input.provider)
    if (!provider) throw new Error(`Unknown provider: ${input.provider}`)
    const audio = await provider.synthesize({
      text,
      voice: input.voiceId ?? voiceForSlot(settings, input.provider),
      rate,
    })
    return { ...audio, provider: input.provider }
  }

  const chain = providerChain(settings)
  let lastError: unknown
  for (const providerId of chain) {
    const provider = getTtsProvider(providerId)
    if (!provider) continue
    try {
      const audio = await provider.synthesize({
        text,
        voice: input.voiceId ?? voiceForSlot(settings, providerId),
        rate,
      })
      return { ...audio, provider: providerId }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('No TTS provider available')
}
