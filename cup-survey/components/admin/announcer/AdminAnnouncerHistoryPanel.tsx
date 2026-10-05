'use client'

import type { AnnouncerEvent } from '@prisma/client'
import { EVENT_TYPE_LABELS } from '@/lib/announcer/types'
import { formatVoiceDisplay } from '@/lib/announcer/voiceDisplay'
import { announcerHistoryItem, announcerQueueItemMeta } from '@/lib/ui/announcerUiClasses'
import { ANNOUNCER_EVENT_STATUS_LABELS } from './announcerLabels'
import { AnnouncerPanel } from './AnnouncerPanel'
import { useAnnouncerProviders } from './useAnnouncerProviders'

export function AdminAnnouncerHistoryPanel(input: { history: AnnouncerEvent[] }) {
  const providers = useAnnouncerProviders()

  return (
    <AnnouncerPanel
      title="История объявлений"
      description="Последние сыгранные, пропущенные и устаревшие сообщения."
    >
      <ul className="space-y-2">
        {input.history.map((event) => {
          const voiceLabel =
            event.ttsProviderUsed && event.ttsVoiceIdUsed
              ? formatVoiceDisplay(event.ttsProviderUsed, event.ttsVoiceIdUsed, providers)
              : null

          return (
            <li key={event.id} className={announcerHistoryItem}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold tabular-nums text-foreground">
                  {event.playedAt
                    ? new Date(event.playedAt).toLocaleString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : new Date(event.createdAt).toLocaleString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                </span>
                <span className={announcerQueueItemMeta}>
                  {ANNOUNCER_EVENT_STATUS_LABELS[event.status]}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {EVENT_TYPE_LABELS[event.type]}
                </span>
                {voiceLabel ? (
                  <span className={announcerQueueItemMeta}>{voiceLabel}</span>
                ) : null}
              </div>
              {event.textSnapshot ? (
                <p className="mt-1 text-sm leading-snug text-muted [overflow-wrap:anywhere]">
                  {event.textSnapshot}
                </p>
              ) : null}
            </li>
          )
        })}
        {input.history.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            История пуста
          </li>
        ) : null}
      </ul>
    </AnnouncerPanel>
  )
}
