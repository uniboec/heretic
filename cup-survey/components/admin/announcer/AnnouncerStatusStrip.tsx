'use client'

import type { AnnouncerMode } from '@prisma/client'
import { Button } from '@/components/ui/Button'
import { adminCompactActionBtn } from '@/lib/ui/adminSurfaceStyles'
import {
  announcerStatusBadge,
  announcerStatusLive,
  announcerStatusOff,
  announcerStatusOn,
  announcerStatusPaused,
  announcerStatusStrip,
} from '@/lib/ui/announcerUiClasses'
import { cn } from '@/lib/cn'
import { ANNOUNCER_MODE_LABELS } from './announcerLabels'

export function AnnouncerStatusStrip(input: {
  enabled: boolean
  mode: AnnouncerMode
  connected: boolean
  onPurgeStale: () => void
}) {
  return (
    <div className={announcerStatusStrip}>
      <span className={cn(announcerStatusBadge, input.enabled ? announcerStatusOn : announcerStatusOff)}>
        <span className={cn('size-1.5 rounded-full', input.enabled ? 'bg-success' : 'bg-muted')} />
        {input.enabled ? 'Включён' : 'Выключен'}
      </span>
      <span
        className={cn(
          announcerStatusBadge,
          input.mode === 'PAUSED' ? announcerStatusPaused : 'border-border bg-background-soft text-foreground',
        )}
        title={input.mode === 'PAUSED' ? 'Автовоспроизведение отключено — используйте ▶ или нажмите «Запустить»' : undefined}
      >
        {ANNOUNCER_MODE_LABELS[input.mode]}
        {input.mode === 'PAUSED' ? ' · только вручную' : ''}
      </span>
      {input.connected ? (
        <span className={cn(announcerStatusBadge, announcerStatusLive)}>
          <span className="size-1.5 animate-pulse rounded-full bg-accent" />
          Live
        </span>
      ) : (
        <span className={cn(announcerStatusBadge, announcerStatusOff)}>Polling</span>
      )}
      <Button variant="secondary" className={adminCompactActionBtn} onClick={input.onPurgeStale}>
        Очистить устаревшие
      </Button>
    </div>
  )
}
