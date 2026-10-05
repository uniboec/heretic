import type { TtsProvider, TtsVoice } from './types'

const VOICES: TtsVoice[] = [
  { id: 'ru-RU-DmitryNeural', name: 'Dmitry' },
  { id: 'ru-RU-SvetlanaNeural', name: 'Svetlana' },
]

export const edgeTtsProvider: TtsProvider = {
  id: 'edge',
  async getVoices() {
    return VOICES
  },
  async healthCheck() {
    const base = process.env.EDGE_TTS_URL ?? 'http://127.0.0.1:5500'
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(2000),
      })
      return response.ok
    } catch {
      return false
    }
  },
  async synthesize({ text, voice, rate }) {
    const base = process.env.EDGE_TTS_URL ?? 'http://127.0.0.1:5500'
    const response = await fetch(`${base.replace(/\/$/, '')}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, voice, rate }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`Edge TTS failed: ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    const mimeType =
      response.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/mpeg'
    return { buffer, mimeType }
  },
}
