'use client'

import { useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { useCueSoundCatalog } from './useCueSoundCatalog'
import type { AnnouncerDashboardDto } from '@/lib/announcer/dto/admin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { adminCompactActionBtn } from '@/lib/ui/adminSurfaceStyles'
import {
  announcerPresetBtn,
  announcerPresetRow,
  announcerSectionDesc,
  announcerSectionTitle,
  announcerUploadZone,
} from '@/lib/ui/announcerUiClasses'
import { cn } from '@/lib/cn'
import { AnnouncerPanel } from './AnnouncerPanel'

const GAP_PRESETS = [
  { label: 'Плотно', seconds: 1, value: 1000 },
  { label: 'Нормально', seconds: 3, value: 3000 },
  { label: 'Спокойно', seconds: 5, value: 5000 },
]

const CUE_GAP_PRESETS = [500, 700, 1000]

function formatGapSeconds(ms: number): string {
  const sec = ms / 1000
  const text = Number.isInteger(sec) ? String(sec) : sec.toFixed(1).replace(/\.0$/, '')
  return `${text} с`
}

export function AdminAnnouncerSoundsPanel(input: {
  settings: AnnouncerDashboardDto['settings']
  onPatch: (patch: Record<string, unknown>) => Promise<void>
}) {
  const { catalog, reloadCatalog } = useCueSoundCatalog()

  const preview = (soundId: string) => {
    const def = catalog.find((s) => s.id === soundId)
    if (!def?.path) return
    const audio = new Audio(withBasePath(def.path))
    audio.volume = input.settings.cueVolume
    void audio.play()
  }

  const uploadCustomCue = async (file: File, family: 'bout' | 'award') => {
    const form = new FormData()
    form.set('file', file)
    form.set('label', file.name.replace(/\.[^.]+$/, ''))
    form.set('family', family)
    form.set('durationMs', '700')
    const response = await fetch(withBasePath('/api/admin/announcer/cues/upload'), {
      method: 'POST',
      body: form,
    })
    const result = await readJsonResponse<{ cue: { id: string; label: string } }>(response)
    if (!result.ok || !result.data?.cue) return
    await reloadCatalog()
    await input.onPatch({
      [family === 'bout' ? 'boutCueSoundId' : 'awardCueSoundId']: result.data.cue.id,
    })
  }

  return (
    <AnnouncerPanel
      title="Сигналы и паузы"
      description="Интервалы между объявлениями и звуковые отбивки перед голосом."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h3 className={announcerSectionTitle}>Пауза между объявлениями</h3>
            <p className={announcerSectionDesc}>Минимальный интервал после завершения одного объявления.</p>
            <div className={cn(announcerPresetRow, 'mt-3')}>
              {GAP_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={announcerPresetBtn(input.settings.announcementGapMs === preset.value)}
                  onClick={() => void input.onPatch({ announcementGapMs: preset.value })}
                >
                  {preset.label} · {preset.seconds} с
                </button>
              ))}
            </div>
            <Input
              className="mt-3"
              label="Интервал (с)"
              type="number"
              min={0}
              max={15}
              step={1}
              value={input.settings.announcementGapMs / 1000}
              onChange={(e) =>
                void input.onPatch({ announcementGapMs: Math.round(Number(e.target.value) * 1000) })
              }
            />
          </div>

          <Select
            label="Пауза между сигналом и голосом"
            value={String(input.settings.cueToSpeechGapMs)}
            onChange={(e) => void input.onPatch({ cueToSpeechGapMs: Number(e.target.value) })}
          >
            {CUE_GAP_PRESETS.map((ms) => (
              <option key={ms} value={ms}>{formatGapSeconds(ms)}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className={announcerSectionTitle}>Звуковые сигналы по умолчанию</h3>
            <p className={announcerSectionDesc}>
              Для каждого типа события можно задать свой сигнал в «Правилах». Здесь — значения по умолчанию.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <Select
                className="flex-1"
                label="Поединки"
                value={input.settings.boutCueSoundId}
                onChange={(e) => void input.onPatch({ boutCueSoundId: e.target.value })}
              >
                {catalog.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
              <Button variant="secondary" className={adminCompactActionBtn} onClick={() => preview(input.settings.boutCueSoundId)}>
                ▶
              </Button>
            </div>

            <div className="flex items-end gap-2">
              <Select
                className="flex-1"
                label="Награждение"
                value={input.settings.awardCueSoundId}
                onChange={(e) => void input.onPatch({ awardCueSoundId: e.target.value })}
              >
                {catalog.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
              <Button variant="secondary" className={adminCompactActionBtn} onClick={() => preview(input.settings.awardCueSoundId)}>
                ▶
              </Button>
            </div>
          </div>

          <div className={announcerUploadZone}>
            <p className="text-sm font-medium text-foreground">Свой сигнал (MP3/WAV, до 5 МБ)</p>
            <p className="text-xs text-muted">Файл сохранится и появится в списке сигналов.</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-accent">
                <span className="rounded-lg border border-border bg-card px-3 py-1.5 font-semibold hover:border-accent/30">
                  Загрузить для поединков
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadCustomCue(file, 'bout')
                    e.currentTarget.value = ''
                  }}
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-accent">
                <span className="rounded-lg border border-border bg-card px-3 py-1.5 font-semibold hover:border-accent/30">
                  Загрузить для награждения
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadCustomCue(file, 'award')
                    e.currentTarget.value = ''
                  }}
                />
              </label>
            </div>
          </div>

          <Input
            label="Громкость сигнала"
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={input.settings.cueVolume}
            onChange={(e) => void input.onPatch({ cueVolume: Number(e.target.value) })}
          />
        </div>
      </div>
    </AnnouncerPanel>
  )
}
