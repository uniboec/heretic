import type { AnnouncerRule, AnnouncerSetting } from '@prisma/client'
import { defaultVoiceForProvider } from './registry'

export function resolveRuleVoice(rule: AnnouncerRule): string | null {
  if (!rule.ttsProvider) return null
  return rule.ttsVoiceId ?? defaultVoiceForProvider(rule.ttsProvider)
}

export function buildGlobalTtsSignature(settings: AnnouncerSetting): string {
  const slots = [
    `${settings.primaryProvider}:${settings.primaryVoiceId ?? '*'}`,
    settings.fallbackProvider1
      ? `${settings.fallbackProvider1}:${settings.fallbackVoiceId1 ?? '*'}`
      : null,
    settings.fallbackProvider2
      ? `${settings.fallbackProvider2}:${settings.fallbackVoiceId2 ?? '*'}`
      : null,
  ]
    .filter(Boolean)
    .join('>')
  return `global|${slots}|${settings.speechRate}`
}

export function buildTtsSignature(
  settings: AnnouncerSetting,
  rule: AnnouncerRule,
): string {
  if (rule.ttsProvider) {
    const voice = resolveRuleVoice(rule)!
    return `${rule.ttsProvider}|${voice}|${settings.speechRate}`
  }
  return buildGlobalTtsSignature(settings)
}

export function ttsPairKey(provider: string, voiceId: string): string {
  return `${provider}|${voiceId}`
}
