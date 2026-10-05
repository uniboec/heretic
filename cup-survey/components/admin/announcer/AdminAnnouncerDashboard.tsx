'use client'

import { useCallback, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { AnnouncerDashboardDto } from '@/lib/announcer/dto/admin'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import {
  adminBoutsCompactStatCard,
  adminBoutsCompactStatValue,
  adminBoutsPage,
  adminBoutsStatsGrid,
  adminPageActionsBtn,
  adminStatCard,
  adminStatLabel,
} from '@/lib/ui/adminSurfaceStyles'
import { announcerAdminTab, announcerAdminTabs, announcerWorkspaceGrid } from '@/lib/ui/announcerUiClasses'
import { semanticAlertClasses } from '@/lib/ui/semanticSurfaceStyles'
import { cn } from '@/lib/cn'
import { useAnnouncerPlayer } from './useAnnouncerPlayer'
import { useAnnouncerStream } from './useAnnouncerStream'
import { AdminAnnouncerHistoryPanel } from './AdminAnnouncerHistoryPanel'
import { AdminAnnouncerNowPlaying } from './AdminAnnouncerNowPlaying'
import { AdminAnnouncerPronunciationPanel } from './AdminAnnouncerPronunciationPanel'
import { AdminAnnouncerQueuePanel } from './AdminAnnouncerQueuePanel'
import { AdminAnnouncerRulesPanel } from './AdminAnnouncerRulesPanel'
import { AdminAnnouncerSoundsPanel } from './AdminAnnouncerSoundsPanel'
import { AdminAnnouncerTtsPanel } from './AdminAnnouncerTtsPanel'
import { ANNOUNCER_MODE_LABELS } from './announcerLabels'
import { AnnouncerStatusStrip } from './AnnouncerStatusStrip'

type TabId = 'workspace' | 'history' | 'pronunciation'

export function AdminAnnouncerDashboard() {
  const { dashboard, connected, error, refresh, setDashboard } = useAnnouncerStream()
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success')
  const [activeTab, setActiveTab] = useState<TabId>('workspace')

  const settings = dashboard?.settings
  const player = useAnnouncerPlayer({
    enabled: settings?.enabled ?? false,
    mode: settings?.mode ?? 'AUTO',
    onPlayConflict: () => {
      setMessage('Уже воспроизводится другое объявление')
      setMessageKind('error')
    },
    onPlaybackError: (playbackError) => {
      setMessage(playbackError)
      setMessageKind('error')
    },
  })

  const patchSettings = useCallback(
    async (patch: Record<string, unknown>) => {
      const response = await fetch(withBasePath('/api/admin/announcer/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const result = await readJsonResponse<{ settings: AnnouncerDashboardDto['settings'] }>(response)
      if (!result.ok || !result.data) {
        setMessage('Не удалось сохранить настройки')
        setMessageKind('error')
        return
      }
      setDashboard((current) => (current ? { ...current, settings: result.data!.settings } : current))
    },
    [setDashboard],
  )

  const patchRule = useCallback(
    async (eventType: string, patch: Record<string, unknown>) => {
      const response = await fetch(withBasePath('/api/admin/announcer/rules'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, patch }),
      })
      if (!response.ok) {
        setMessage('Не удалось обновить правило')
        setMessageKind('error')
        return
      }
      await refresh()
    },
    [refresh],
  )

  const reorderRules = useCallback(async (orderedEventTypes: string[]) => {
    await fetch(withBasePath('/api/admin/announcer/rules'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedEventTypes }),
    })
    await refresh()
  }, [refresh])

  const startAnnouncer = useCallback(async () => {
    player.unlock()
    const response = await fetch(withBasePath('/api/admin/announcer/start'), { method: 'POST' })
    const result = await readJsonResponse<AnnouncerDashboardDto>(response)
    if (result.ok && result.data) {
      setDashboard(result.data)
      setMessage('Информатор запущен')
      setMessageKind('success')
      return
    }
    setMessage(result.ok ? 'Не удалось запустить информатор' : result.error)
    setMessageKind('error')
  }, [player, setDashboard])

  const stopAnnouncer = useCallback(async () => {
    const response = await fetch(withBasePath('/api/admin/announcer/stop'), { method: 'POST' })
    const result = await readJsonResponse<AnnouncerDashboardDto>(response)
    if (result.ok && result.data) {
      setDashboard(result.data)
      setMessage('Информатор остановлен')
      setMessageKind('success')
      return
    }
    setMessage(result.ok ? 'Не удалось остановить информатор' : result.error)
    setMessageKind('error')
  }, [setDashboard])

  const purgeStale = useCallback(async () => {
    await fetch(withBasePath('/api/admin/announcer/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'purgeStale' }),
    })
    await refresh()
    setMessage('Устаревшие объявления очищены')
    setMessageKind('success')
  }, [refresh])

  if (!dashboard) {
    return (
      <div className={adminBoutsPage}>
        <div className={cn(adminStatCard, 'px-5 py-8 text-center text-sm text-muted')}>
          Загрузка информатора…
        </div>
      </div>
    )
  }

  const isPaused = dashboard.settings.mode === 'PAUSED'

  return (
    <div className={adminBoutsPage}>
      <AdminPageHeader
        title="Голосовой информатор"
        description="Очередь объявлений, синтез речи и воспроизведение для поединков и награждения."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label="Режим"
              value={dashboard.settings.mode}
              onChange={(e) => void patchSettings({ mode: e.target.value })}
              className="min-w-[9rem]"
              size="sm"
            >
              {Object.entries(ANNOUNCER_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Button className={adminPageActionsBtn} onClick={() => void startAnnouncer()}>
              Запустить
            </Button>
            <Button className={adminPageActionsBtn} variant="secondary" onClick={() => void stopAnnouncer()}>
              Остановить
            </Button>
            <Button
              className={adminPageActionsBtn}
              variant="secondary"
              onClick={() => void patchSettings({ mode: isPaused ? 'AUTO' : 'PAUSED' })}
            >
              {isPaused ? 'Снять паузу' : 'Пауза'}
            </Button>
          </div>
        }
      />

      {message ? (
        <div className={messageKind === 'success' ? semanticAlertClasses.success : semanticAlertClasses.danger}>
          {message}
        </div>
      ) : null}
      {error ? <div className={semanticAlertClasses.warning}>{error}</div> : null}

      <AnnouncerStatusStrip
        enabled={dashboard.settings.enabled}
        mode={dashboard.settings.mode}
        connected={connected}
        onPurgeStale={() => void purgeStale()}
      />

      <div className={adminBoutsStatsGrid}>
        <div className={cn(adminStatCard, adminBoutsCompactStatCard)}>
          <div className={adminStatLabel}>Объявлений</div>
          <div className={cn(adminBoutsCompactStatValue, 'text-foreground')}>{dashboard.stats.playedCount}</div>
        </div>
        <div className={cn(adminStatCard, adminBoutsCompactStatCard)}>
          <div className={adminStatLabel}>Речь</div>
          <div className={cn(adminBoutsCompactStatValue, 'text-foreground')}>
            ~{dashboard.stats.estimatedSpeechSeconds} сек
          </div>
        </div>
        <div className={cn(adminStatCard, adminBoutsCompactStatCard)}>
          <div className={adminStatLabel}>Символов</div>
          <div className={cn(adminBoutsCompactStatValue, 'text-foreground')}>
            {dashboard.stats.estimatedCharCount}
          </div>
        </div>
        <div className={cn(adminStatCard, adminBoutsCompactStatCard)}>
          <div className={adminStatLabel}>Оценка TTS</div>
          <div className={cn(adminBoutsCompactStatValue, 'text-foreground')}>
            ~{dashboard.stats.estimatedCostRub} ₽
          </div>
        </div>
      </div>

      <AdminAnnouncerNowPlaying
        localSnapshot={player.activeSnapshot}
        remotePlaying={dashboard.playing}
      />

      <div className={announcerAdminTabs}>
        {([
          ['workspace', 'Рабочая область'],
          ['history', 'История'],
          ['pronunciation', 'Произношение'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={announcerAdminTab(activeTab === id)}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'workspace' && (
        <div className={announcerWorkspaceGrid}>
          <div className="space-y-5">
            <AdminAnnouncerQueuePanel
              queue={dashboard.queue}
              playing={dashboard.playing}
              settings={dashboard.settings}
              rules={dashboard.rules}
              enabled={dashboard.settings.enabled}
              onPlay={(id) => {
                player.unlock()
                void player.playEvent(id)
              }}
              onRefresh={refresh}
            />
          </div>
          <div className="space-y-5">
            <AdminAnnouncerSoundsPanel settings={dashboard.settings} onPatch={patchSettings} />
            <AdminAnnouncerTtsPanel settings={dashboard.settings} onPatch={patchSettings} />
          </div>
          <div className="xl:col-span-2">
            <AdminAnnouncerRulesPanel
              rules={dashboard.rules}
              onPatchRule={patchRule}
              onReorder={reorderRules}
            />
          </div>
        </div>
      )}

      {activeTab === 'history' && <AdminAnnouncerHistoryPanel history={dashboard.history} />}
      {activeTab === 'pronunciation' && <AdminAnnouncerPronunciationPanel />}
    </div>
  )
}
