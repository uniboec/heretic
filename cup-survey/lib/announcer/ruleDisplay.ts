import type { AnnouncerRule } from '@prisma/client'
import type { CueSoundDefinition } from '@/lib/announcer/cueCatalog'
import { formatVoiceDisplay, type ProviderInfo } from '@/lib/announcer/voiceDisplay'

export const ANNOUNCER_RULE_INCLUDE_TOGGLES: Array<[keyof AnnouncerRule, string]> = [
  ['includeMat', 'Татами'],
  ['includeCategory', 'Категория'],
  ['includeCorner', 'Угол'],
  ['includeClub', 'Клуб'],
  ['includeCity', 'Город'],
  ['includeMethod', 'Способ'],
  ['includePlacement', 'Место'],
  ['includeAge', 'Возраст'],
  ['includeWeight', 'Вес'],
  ['includeCueSound', 'Сигнал'],
]

export const ANNOUNCER_RULE_ALL_TOGGLES: Array<[keyof AnnouncerRule, string]> = [
  ['enabled', 'Включено'],
  ...ANNOUNCER_RULE_INCLUDE_TOGGLES,
]

export function formatAnnouncerRuleNameFormat(rule: AnnouncerRule): string {
  return rule.nameFormat === 'LAST_FIRST_MIDDLE' ? 'ФИО полностью' : 'Фамилия и имя'
}

export function formatAnnouncerRuleVoiceSummary(
  rule: AnnouncerRule,
  providers: ProviderInfo[],
): string {
  if (!rule.ttsProvider) return 'Голос по умолчанию'
  return formatVoiceDisplay(
    rule.ttsProvider,
    rule.ttsVoiceId ?? '',
    providers,
  )
}

export function formatAnnouncerRuleIncludeSummary(rule: AnnouncerRule): string {
  const labels = ANNOUNCER_RULE_INCLUDE_TOGGLES
    .filter(([key]) => Boolean(rule[key]))
    .map(([, label]) => label)

  return labels.length > 0 ? labels.join(' · ') : 'Без доп. полей'
}

export function formatAnnouncerRuleCueSummary(
  rule: AnnouncerRule,
  cueSounds: CueSoundDefinition[],
): string | null {
  if (!rule.includeCueSound) return null
  if (!rule.cueSoundId) return 'Сигнал по умолчанию'
  const sound = cueSounds.find((entry) => entry.id === rule.cueSoundId)
  return sound?.label ?? rule.cueSoundId
}
