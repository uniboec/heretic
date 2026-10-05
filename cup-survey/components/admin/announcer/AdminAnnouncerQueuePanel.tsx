'use client'

import { useMemo } from 'react'
import { withBasePath } from '@/lib/basePath'
import type { AnnouncerEvent, AnnouncerEventStatus, AnnouncerRule, AnnouncerSetting } from '@prisma/client'
import { EVENT_TYPE_LABELS } from '@/lib/announcer/types'
import { formatVoiceDisplay, resolveEventVoice } from '@/lib/announcer/voiceDisplay'
import { Button } from '@/components/ui/Button'
import { adminCompactActionBtn } from '@/lib/ui/adminSurfaceStyles'
import {
  announcerEventStatusBadge,
  announcerEventStatusMuted,
  announcerEventStatusPlaying,
  announcerEventStatusQueued,
  announcerEventStatusReady,
  announcerQueueItem,
  announcerQueueItemActions,
  announcerQueueItemActive,
  announcerQueueItemMeta,
  announcerQueueItemText,
  announcerQueueList,
  announcerQueueSectionLabel,
} from '@/lib/ui/announcerUiClasses'
import { cn } from '@/lib/cn'
import { ANNOUNCER_EVENT_STATUS_LABELS } from './announcerLabels'
import { AnnouncerPanel } from './AnnouncerPanel'
import { useAnnouncerProviders } from './useAnnouncerProviders'

function statusBadgeClass(status: AnnouncerEventStatus): string {
  switch (status) {
    case 'READY':
      return announcerEventStatusReady
    case 'PLAYING':
      return announcerEventStatusPlaying
    case 'QUEUED':
    case 'GENERATING':
      return announcerEventStatusQueued
    default:
      return announcerEventStatusMuted
  }
}

function EventRow(input: {
  event: AnnouncerEvent
  rule?: AnnouncerRule
  settings: AnnouncerSetting
  providers: ReturnType<typeof useAnnouncerProviders>
  active?: boolean
  onPlay?: () => void
  onRepeat: () => void
}) {
  const voice = resolveEventVoice(input.event, input.rule, input.settings)
  const voiceLabel = formatVoiceDisplay(voice.provider, voice.voiceId, input.providers)

  return (
    <li className={cn(announcerQueueItem, input.active && announcerQueueItemActive)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(announcerEventStatusBadge, statusBadgeClass(input.event.status))}>
              {ANNOUNCER_EVENT_STATUS_LABELS[input.event.status]}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {EVENT_TYPE_LABELS[input.event.type]}
            </span>
            <span className={announcerQueueItemMeta}>Приоритет {input.event.priority}</span>
            {input.providers.length > 0 ? (
              <span className={announcerQueueItemMeta}>{voiceLabel}</span>
            ) : null}
          </div>
          {input.event.textSnapshot ? (
            <p className={announcerQueueItemText}>{input.event.textSnapshot}</p>
          ) : null}
        </div>
        <div className={announcerQueueItemActions}>
          {input.onPlay ? (
            <Button variant="secondary" className={adminCompactActionBtn} onClick={input.onPlay}>
              ▶ Воспроизвести
            </Button>
          ) : null}
          <Button variant="secondary" className={adminCompactActionBtn} onClick={input.onRepeat}>
            Повторить
          </Button>
        </div>
      </div>
    </li>
  )
}

export function AdminAnnouncerQueuePanel(input: {
  queue: AnnouncerEvent[]
  playing: AnnouncerEvent | null
  settings: AnnouncerSetting
  rules: AnnouncerRule[]
  enabled: boolean
  onPlay: (eventId: string) => void
  onRefresh: () => void
}) {
  const providers = useAnnouncerProviders()
  const rulesByType = useMemo(
    () => new Map(input.rules.map((rule) => [rule.eventType, rule])),
    [input.rules],
  )

  const { now, next } = useMemo(() => {
    const playingId = input.playing?.id
    const ready = input.queue.filter((e) => e.status === 'READY')
    const current = playingId
      ? input.queue.find((e) => e.id === playingId) ?? input.playing
      : ready[0] ?? null
    const nextItems = input.queue.filter((e) => e.id !== current?.id)
    return { now: current, next: nextItems }
  }, [input.playing, input.queue])

  const repeat = (eventId: string) => {
    void fetch(withBasePath(`/api/admin/announcer/events/${eventId}/repeat`), { method: 'POST' }).then(
      () => input.onRefresh(),
    )
  }

  return (
    <AnnouncerPanel
      title="Очередь объявлений"
      description="Текущее и следующие сообщения. Готовые объявления можно запустить вручную."
      actions={
        <Button variant="secondary" className={adminCompactActionBtn} onClick={input.onRefresh}>
          Обновить
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <h3 className={announcerQueueSectionLabel}>Сейчас</h3>
          {now ? (
            <ul className={announcerQueueList}>
              <EventRow
                event={now}
                rule={rulesByType.get(now.type)}
                settings={input.settings}
                providers={providers}
                active
                onPlay={now.status === 'READY' ? () => input.onPlay(now.id) : undefined}
                onRepeat={() => repeat(now.id)}
              />
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
              Нет активного объявления
            </p>
          )}
        </div>

        <div>
          <h3 className={announcerQueueSectionLabel}>Следующие</h3>
          <ul className={announcerQueueList}>
            {next.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                rule={rulesByType.get(event.type)}
                settings={input.settings}
                providers={providers}
                onPlay={event.status === 'READY' ? () => input.onPlay(event.id) : undefined}
                onRepeat={() => repeat(event.id)}
              />
            ))}
            {next.length === 0 ? (
              <li className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted">
                {input.enabled
                  ? input.settings.mode === 'MANUAL'
                    ? 'Очередь пуста. Нажмите «Запустить», чтобы пересобрать объявления по текущим коврам и награждению. В ручном режиме готовые объявления запускаются кнопкой ▶.'
                    : 'Очередь пуста. Новые объявления появятся при смене поединка на ковре, завершении схватки или изменении очереди награждения. Нажмите «Запустить», если нужно пересобрать очередь сейчас.'
                  : 'Информатор выключен. Нажмите «Запустить», чтобы включить объявления по текущему расписанию.'}
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </AnnouncerPanel>
  )
}
