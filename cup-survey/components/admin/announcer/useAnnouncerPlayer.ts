'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import type { PlaybackSnapshot } from '@/lib/announcer/types'
import { playMediaUrl, unlockBrowserAudioPlayback } from './playAudioBlob'

const HEARTBEAT_MS = 15_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useAnnouncerPlayer(input: {
  enabled: boolean
  mode: 'AUTO' | 'MANUAL' | 'PAUSED'
  onPlaybackStart?: (snapshot: PlaybackSnapshot) => void
  onPlaybackEnd?: () => void
  onPlayConflict?: () => void
  onPlaybackError?: (message: string) => void
}) {
  const [activeSnapshot, setActiveSnapshot] = useState<PlaybackSnapshot | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const playingRef = useRef(false)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const unlock = useCallback(() => {
    if (typeof window === 'undefined') return
    setUnlocked(true)
    unlockBrowserAudioPlayback()
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const release = useCallback(async (snapshot: PlaybackSnapshot) => {
    await fetch(withBasePath(`/api/admin/announcer/events/${snapshot.eventId}/release`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimToken: snapshot.claimToken }),
    })
  }, [])

  const complete = useCallback(async (snapshot: PlaybackSnapshot) => {
    await fetch(withBasePath(`/api/admin/announcer/events/${snapshot.eventId}/complete`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimToken: snapshot.claimToken }),
    })
    stopHeartbeat()
    playingRef.current = false
    setActiveSnapshot(null)
    input.onPlaybackEnd?.()
  }, [input, stopHeartbeat])

  const playSnapshot = useCallback(async (snapshot: PlaybackSnapshot) => {
    if (playingRef.current) return
    playingRef.current = true
    setActiveSnapshot(snapshot)
    input.onPlaybackStart?.(snapshot)

    heartbeatRef.current = setInterval(() => {
      void fetch(withBasePath(`/api/admin/announcer/events/${snapshot.eventId}/heartbeat`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimToken: snapshot.claimToken }),
      })
    }, HEARTBEAT_MS)

    try {
      if (snapshot.cue?.url) {
        try {
          await playMediaUrl(snapshot.cue.url)
        } catch {
          // Cue is optional — continue with speech even if the chime fails.
        }
      }

      if (snapshot.cueToSpeechGapMs > 0) {
        await sleep(snapshot.cueToSpeechGapMs)
      }

      const sinkId = localStorage.getItem('announcer-audio-sink-id')?.trim() || null
      await playMediaUrl(withBasePath(snapshot.speech.url), sinkId)
      await complete(snapshot)
    } catch {
      stopHeartbeat()
      playingRef.current = false
      setActiveSnapshot(null)
      void release(snapshot).catch(() => undefined)
      input.onPlaybackError?.('Не удалось воспроизвести объявление')
    }
  }, [complete, input, release, stopHeartbeat])

  const claimNext = useCallback(async () => {
    if (!input.enabled || input.mode !== 'AUTO' || playingRef.current) return
    try {
      const response = await fetch(withBasePath('/api/admin/announcer/events/claim'), {
        method: 'POST',
      })
      if (response.status === 204) return
      if (!response.ok) return
      const body = (await response.json()) as { snapshot: PlaybackSnapshot }
      await playSnapshot(body.snapshot)
    } catch {
      // Server restarting or network blip — next poll will retry.
    }
  }, [input.enabled, input.mode, playSnapshot])

  const playEvent = useCallback(
    async (eventId: string) => {
      if (playingRef.current) return
      unlockBrowserAudioPlayback()
      setUnlocked(true)

      let response: Response
      try {
        response = await fetch(withBasePath(`/api/admin/announcer/events/${eventId}/play`), {
          method: 'POST',
        })
      } catch {
        input.onPlaybackError?.('Нет связи с сервером — попробуйте снова')
        return
      }
      if (response.status === 204) {
        input.onPlaybackError?.('Воспроизведение временно заблокировано паузой между объявлениями')
        return
      }
      if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as { code?: string; error?: string } | null
        if (body?.code === 'ALREADY_PLAYING') {
          input.onPlayConflict?.()
          return
        }
        input.onPlaybackError?.(body?.error ?? 'Аудио ещё не готово — подождите синтез')
        return
      }
      if (response.status === 403) {
        input.onPlaybackError?.('Информатор выключен или режим не позволяет воспроизведение')
        return
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        input.onPlaybackError?.(body?.error ?? 'Не удалось запустить воспроизведение')
        return
      }
      const text = await response.text()
      if (!text.trim()) {
        input.onPlaybackError?.('Сервер вернул пустой ответ')
        return
      }
      const body = JSON.parse(text) as { snapshot: PlaybackSnapshot }
      await playSnapshot(body.snapshot)
    },
    [input.onPlayConflict, input.onPlaybackError, playSnapshot],
  )

  useEffect(() => {
    if (!input.enabled || input.mode !== 'AUTO' || !unlocked) return
    const timer = setInterval(() => {
      void claimNext()
    }, 1200)
    return () => clearInterval(timer)
  }, [claimNext, input.enabled, input.mode, unlocked])

  return {
    unlocked,
    unlock,
    activeSnapshot,
    claimNext,
    playEvent,
    isPlaying: playingRef.current,
  }
}
