'use client'

import { Select } from '@/components/ui/Select'
import { announcerRuleToggle } from '@/lib/ui/announcerUiClasses'
import type { ProviderInfo } from '@/lib/announcer/voiceDisplay'

export type AnnouncerVoiceValue = {
  ttsProvider: string | null
  ttsVoiceId: string | null
}

export function AnnouncerVoicePicker(input: {
  providers: ProviderInfo[]
  value: AnnouncerVoiceValue
  onChange: (value: AnnouncerVoiceValue) => void
  modeName?: string
}) {
  const modeName = input.modeName ?? 'voice-mode'
  const customMode = input.value.ttsProvider !== null
  const voicesFor = (providerId: string | null | undefined) =>
    input.providers.find((provider) => provider.id === providerId)?.voices ?? []

  const defaultVoiceFor = (providerId: string) =>
    input.providers.find((provider) => provider.id === providerId)?.defaultVoiceId ??
    input.providers
      .find((provider) => provider.id === providerId)
      ?.voices[0]?.id ??
    null

  const enableCustomMode = () => {
    const preferred =
      input.providers.find((provider) => input.value.ttsProvider === provider.id) ??
      input.providers[0]
    if (!preferred) return
    input.onChange({
      ttsProvider: preferred.id,
      ttsVoiceId: input.value.ttsVoiceId ?? defaultVoiceFor(preferred.id),
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <label className={announcerRuleToggle}>
          <input
            type="radio"
            name={modeName}
            checked={!customMode}
            onChange={() => input.onChange({ ttsProvider: null, ttsVoiceId: null })}
          />
          По умолчанию (глобальный голос)
        </label>
        <label className={announcerRuleToggle}>
          <input
            type="radio"
            name={modeName}
            checked={customMode}
            onChange={enableCustomMode}
          />
          Свой голос
        </label>
      </div>

      {customMode ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Провайдер"
            value={input.value.ttsProvider ?? ''}
            onChange={(e) => {
              const provider = e.target.value || null
              input.onChange({
                ttsProvider: provider,
                ttsVoiceId: provider ? defaultVoiceFor(provider) : null,
              })
            }}
          >
            {input.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </Select>
          <Select
            label="Голос"
            value={input.value.ttsVoiceId ?? ''}
            onChange={(e) =>
              input.onChange({
                ttsProvider: input.value.ttsProvider,
                ttsVoiceId: e.target.value || null,
              })
            }
          >
            <option value="">По умолчанию для провайдера</option>
            {voicesFor(input.value.ttsProvider).map((voice) => (
              <option key={voice.id} value={voice.id}>{voice.name}</option>
            ))}
          </Select>
        </div>
      ) : null}
    </div>
  )
}
