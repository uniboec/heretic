'use client'

import { useEffect, useState } from 'react'
import type { AnnouncerEvent } from '@prisma/client'
import type { PlaybackSnapshot } from '@/lib/announcer/types'
import { EVENT_TYPE_LABELS } from '@/lib/announcer/types'
import {
  announcerNowPlayingCard,
  announcerNowPlayingText,
  announcerNowPlayingTimer,
  announcerNowPlayingTitle,
} from '@/lib/ui/announcerUiClasses'
import { semanticAlertClasses } from '@/lib/ui/semanticSurfaceStyles'

export function AdminAnnouncerNowPlaying(input: {
  localSnapshot: PlaybackSnapshot | null
  remotePlaying: AnnouncerEvent | null
}) {
  const [remainingSec, setRemainingSec] = useState<number | null>(null)
  const snapshot = input.localSnapshot
  const remote = input.remotePlaying

  useEffect(() => {
    if (!snapshot?.leaseUntil) {
      setRemainingSec(null)
      return
    }
    const tick = () => {
      const ms = new Date(snapshot.leaseUntil).getTime() - Date.now()
      setRemainingSec(Math.max(0, Math.ceil(ms / 1000)))
    }
    tick()
    const timer = setInterval(tick, 500)
    return () => clearInterval(timer)
  }, [snapshot?.leaseUntil])

  if (!snapshot && !remote) return null

  const text = snapshot?.textSnapshot ?? remote?.textSnapshot
  const label = remote ? EVENT_TYPE_LABELS[remote.type] : 'Воспроизведение'

  return (
    <div className={announcerNowPlayingCard}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={announcerNowPlayingTitle}>Сейчас в эфире · {label}</div>
          {text ? <p className={announcerNowPlayingText}>{text}</p> : null}
          {!snapshot && remote ? (
            <p className="mt-2 text-xs text-muted">Воспроизведение на другом устройстве</p>
          ) : null}
        </div>
        {remainingSec != null ? (
          <span className={announcerNowPlayingTimer}>~{remainingSec} сек</span>
        ) : null}
      </div>
      {!snapshot && remote ? (
        <div className={`${semanticAlertClasses.warning} mt-3`}>
          Локальный плеер не активен — управление с другой вкладки или устройства.
        </div>
      ) : null}
    </div>
  )
}
