import type { TtsProvider, TtsVoice } from './types'

export const piperTtsProvider: TtsProvider = {
  id: 'piper',
  async getVoices() {
    return [{ id: 'dmitri', name: 'Dmitri' }]
  },
  async healthCheck() {
    return Boolean(process.env.PIPER_TTS_URL)
  },
  async synthesize({ text, voice, rate }) {
    const base = process.env.PIPER_TTS_URL
    if (!base) throw new Error('PIPER_TTS_URL missing')
    const response = await fetch(`${base.replace(/\/$/, '')}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`Piper TTS failed: ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    return { buffer, mimeType: response.headers.get('content-type') ?? 'audio/wav' }
  },
}
