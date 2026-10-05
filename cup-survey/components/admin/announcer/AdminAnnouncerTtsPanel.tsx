'use client'

import { useCallback, useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { AnnouncerDashboardDto } from '@/lib/announcer/dto/admin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { adminCompactActionBtn } from '@/lib/ui/adminSurfaceStyles'
import { announcerProviderChip, announcerSectionDesc, announcerSectionTitle } from '@/lib/ui/announcerUiClasses'
import { semanticAlertClasses } from '@/lib/ui/semanticSurfaceStyles'
import { cn } from '@/lib/cn'
import { AnnouncerPanel } from './AnnouncerPanel'
import { playAudioBlob, playbackErrorMessage, unlockBrowserAudioPlayback } from './playAudioBlob'

type ProviderInfo = {
  id: string
  label: string
  healthy: boolean
  defaultVoiceId: string
  voices: Array<{ id: string; name: string }>
}

export function AdminAnnouncerTtsPanel(input: {
  settings: AnnouncerDashboardDto['settings']
  onPatch: (patch: Record<string, unknown>) => Promise<void>
}) {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [testText, setTestText] = useState('Проверка голосового информатора.')
  const [audioSinkId, setAudioSinkId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setAudioSinkId(localStorage.getItem('announcer-audio-sink-id') ?? '')
    void fetch(withBasePath('/api/admin/announcer/providers'), { cache: 'no-store' })
      .then((r) => readJsonResponse<{ providers: ProviderInfo[] }>(r))
      .then((result) => {
        if (result.ok && result.data) setProviders(result.data.providers)
      })
  }, [])

  const voicesFor = useCallback(
    (providerId: string | null | undefined) =>
      providers.find((p) => p.id === providerId)?.voices ?? [],
    [providers],
  )

  const testVoice = useCallback(async () => {
    unlockBrowserAudioPlayback()

    const response = await fetch(withBasePath('/api/admin/announcer/synthesize'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testText }),
    })
    if (!response.ok) {
      const result = await readJsonResponse<{ error?: string }>(response)
      setMessage(result.ok ? 'Синтез не удался' : result.error)
      return
    }

    const mimeType =
      response.headers.get('Content-Type')?.split(';')[0]?.trim() || 'audio/mpeg'
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength === 0) {
      setMessage('Сервер вернул пустой аудиофайл')
      return
    }

    const blob = new Blob([bytes], { type: mimeType })
    try {
      await playAudioBlob(blob)
      setMessage(null)
    } catch (error) {
      setMessage(playbackErrorMessage(error))
    }
  }, [testText])

  const slots = [
    {
      label: 'Основной',
      providerKey: 'primaryProvider',
      voiceKey: 'primaryVoiceId',
      provider: input.settings.primaryProvider,
      voice: input.settings.primaryVoiceId,
    },
    {
      label: 'Резерв 1',
      providerKey: 'fallbackProvider1',
      voiceKey: 'fallbackVoiceId1',
      provider: input.settings.fallbackProvider1,
      voice: input.settings.fallbackVoiceId1,
    },
    {
      label: 'Резерв 2',
      providerKey: 'fallbackProvider2',
      voiceKey: 'fallbackVoiceId2',
      provider: input.settings.fallbackProvider2,
      voice: input.settings.fallbackVoiceId2,
    },
  ]

  return (
    <AnnouncerPanel
      title="Синтез речи (TTS)"
      description="Глобальный голос по умолчанию — используется типами событий без своего переопределения в правилах."
    >
      <div className="space-y-5">
        <div>
          <h3 className={announcerSectionTitle}>Статус провайдеров</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {providers.map((provider) => (
              <span key={provider.id} className={announcerProviderChip(provider.healthy)}>
                {provider.id}: {provider.healthy ? 'готов' : 'нет ключей'}
              </span>
            ))}
          </div>
        </div>

        <Input
          label="Устройство вывода (deviceId)"
          hint="Для setSinkId в браузере. Оставьте пустым для системного устройства."
          value={audioSinkId}
          onChange={(e) => {
            setAudioSinkId(e.target.value)
            localStorage.setItem('announcer-audio-sink-id', e.target.value)
          }}
          placeholder="default"
        />

        <div className="space-y-4">
          {slots.map((slot) => (
            <div key={slot.label} className="grid gap-3 rounded-lg border border-border/90 bg-background-soft/40 p-3 sm:grid-cols-2">
              <Select
                label={`${slot.label} — провайдер`}
                value={slot.provider ?? ''}
                onChange={(e) =>
                  void input.onPatch({
                    [slot.providerKey]: e.target.value || null,
                  })
                }
              >
                <option value="">—</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.id}</option>
                ))}
              </Select>
              <Select
                label={`${slot.label} — голос`}
                value={slot.voice ?? ''}
                onChange={(e) =>
                  void input.onPatch({
                    [slot.voiceKey]: e.target.value || null,
                  })
                }
              >
                <option value="">По умолчанию</option>
                {voicesFor(slot.provider).map((voice) => (
                  <option key={voice.id} value={voice.id}>{voice.name}</option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        <Input
          label="Скорость речи"
          type="number"
          step="0.05"
          min="0.7"
          max="1.3"
          value={input.settings.speechRate}
          onChange={(e) => void input.onPatch({ speechRate: Number(e.target.value) })}
        />

        <div>
          <h3 className={announcerSectionTitle}>Проверка голоса</h3>
          <p className={announcerSectionDesc}>Синтезирует тестовую фразу через текущие настройки.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              className="flex-1"
              controlOnly
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
            />
            <Button variant="secondary" className={cn(adminCompactActionBtn, 'sm:self-end')} onClick={() => void testVoice()}>
              Проверить
            </Button>
          </div>
          {message ? <div className={cn(semanticAlertClasses.warning, 'mt-3')}>{message}</div> : null}
        </div>
      </div>
    </AnnouncerPanel>
  )
}
