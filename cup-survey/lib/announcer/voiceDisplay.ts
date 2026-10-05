import type { AnnouncerEvent, AnnouncerRule, AnnouncerSetting } from '@prisma/client'
import { defaultVoiceForProvider } from './tts/registry'

export type ProviderInfo = {
  id: string
  label: string
  defaultVoiceId?: string
  voices: Array<{ id: string; name: string }>
}

export function resolveEventVoice(
  event: AnnouncerEvent,
  rule: AnnouncerRule | undefined,
  settings: AnnouncerSetting,
): { provider: string; voiceId: string } {
  if (event.ttsProviderUsed && event.ttsVoiceIdUsed) {
    return { provider: event.ttsProviderUsed, voiceId: event.ttsVoiceIdUsed }
  }
  if (rule?.ttsProvider) {
    return {
      provider: rule.ttsProvider,
      voiceId: rule.ttsVoiceId ?? defaultVoiceForProvider(rule.ttsProvider),
    }
  }
  return {
    provider: settings.primaryProvider,
    voiceId: settings.primaryVoiceId ?? defaultVoiceForProvider(settings.primaryProvider),
  }
}

export function formatVoiceDisplay(
  provider: string,
  voiceId: string,
  providers: ProviderInfo[],
): string {
  const providerInfo = providers.find((item) => item.id === provider)
  const voice = providerInfo?.voices.find((item) => item.id === voiceId)
  return `${providerInfo?.label ?? provider} / ${voice?.name ?? voiceId}`
}
