import type { TtsProvider, TtsVoice } from './types'

export const sileroTtsProvider: TtsProvider = {
  id: 'silero',
  async getVoices() {
    return [{ id: 'ru_v3', name: 'Russian v3' }]
  },
  async healthCheck() {
    return Boolean(process.env.SILERO_TTS_URL)
  },
  async synthesize({ text, voice, rate }) {
    const base = process.env.SILERO_TTS_URL
    if (!base) throw new Error('SILERO_TTS_URL missing')
    const response = await fetch(`${base.replace(/\/$/, '')}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker: voice, speed: rate }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`Silero TTS failed: ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    return { buffer, mimeType: 'audio/wav' }
  },
}
