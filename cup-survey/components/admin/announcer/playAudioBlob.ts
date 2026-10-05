'use client'

import { withBasePath } from '@/lib/basePath'

let sharedAudioContext: AudioContext | null = null

function getOrCreateAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('AUDIO_CONTEXT_UNAVAILABLE')
  }
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext()
  }
  return sharedAudioContext
}

/** Resume audio context during a user gesture (before long async TTS requests). */
export function unlockBrowserAudioPlayback(): void {
  if (typeof window === 'undefined') return
  try {
    const ctx = getOrCreateAudioContext()
    void ctx.resume()
    const cue = new Audio(withBasePath('/sounds/announcer/universfield-056.mp3'))
    cue.volume = 0.001
    void cue.play().catch(() => undefined)
  } catch {
    // Ignore — HTML fallback may still work.
  }
}

async function playViaWebAudio(blob: Blob): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('AudioContext' in window)) return false

  try {
    const ctx = getOrCreateAudioContext()
    await ctx.resume()
    const bytes = await blob.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(bytes.slice(0))
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    await new Promise<void>((resolve, reject) => {
      source.onended = () => resolve()
      try {
        source.start(0)
      } catch (error) {
        reject(error)
      }
    })
    return true
  } catch {
    return false
  }
}

async function playViaHtmlAudio(blob: Blob, sinkId?: string | null): Promise<void> {
  const url = URL.createObjectURL(blob)
  const audio = new Audio()

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      resolve()
    }, 8000)

    const cleanup = () => {
      clearTimeout(timeout)
      audio.removeEventListener('canplaythrough', onReady)
      audio.removeEventListener('error', onError)
    }

    const onReady = () => {
      cleanup()
      resolve()
    }

    const onError = () => {
      cleanup()
      reject(new Error('AUDIO_LOAD_FAILED'))
    }

    audio.addEventListener('canplaythrough', onReady)
    audio.addEventListener('error', onError)
    audio.src = url
    audio.load()

    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      onReady()
    }
  })

  if (sinkId && 'setSinkId' in audio) {
    try {
      await (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(
        sinkId,
      )
    } catch {
      // Ignore invalid output device ids.
    }
  }

  try {
    await audio.play()
    await new Promise<void>((resolve) => {
      audio.addEventListener('ended', () => resolve(), { once: true })
      audio.addEventListener('error', () => resolve(), { once: true })
    })
  } finally {
    audio.pause()
    audio.src = ''
    URL.revokeObjectURL(url)
  }
}

export async function playAudioBlob(blob: Blob, sinkId?: string | null): Promise<void> {
  if (blob.size === 0) {
    throw new Error('AUDIO_EMPTY')
  }

  const playedWithWebAudio = await playViaWebAudio(blob)
  if (playedWithWebAudio) return

  await playViaHtmlAudio(blob, sinkId)
}

export async function playMediaUrl(url: string, sinkId?: string | null): Promise<void> {
  const response = await fetch(url, { credentials: 'include', cache: 'no-store' })
  if (!response.ok) {
    throw new Error('AUDIO_FETCH_FAILED')
  }
  const mimeType =
    response.headers.get('Content-Type')?.split(';')[0]?.trim() || 'audio/mpeg'
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new Error('AUDIO_EMPTY')
  }
  await playAudioBlob(new Blob([bytes], { type: mimeType }), sinkId)
}

export function playbackErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Браузер заблокировал воспроизведение. Нажмите кнопку ещё раз.'
  }
  if (error instanceof Error) {
    if (error.message === 'AUDIO_FETCH_FAILED') {
      return 'Не удалось загрузить аудио с сервера'
    }
    if (error.message === 'AUDIO_EMPTY' || error.message === 'AUDIO_LOAD_FAILED') {
      return 'Получен пустой или повреждённый аудиофайл'
    }
  }
  return 'Браузер не смог воспроизвести аудио'
}
