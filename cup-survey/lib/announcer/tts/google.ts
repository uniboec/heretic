import type { TtsProvider, TtsVoice } from './types'

const VOICES: TtsVoice[] = [
  { id: 'ru-RU-Wavenet-D', name: 'Wavenet D' },
  { id: 'ru-RU-Wavenet-A', name: 'Wavenet A' },
]

export const googleTtsProvider: TtsProvider = {
  id: 'google',
  async getVoices() {
    return VOICES
  },
  async healthCheck() {
    return Boolean(process.env.GOOGLE_TTS_API_KEY)
  },
  async synthesize({ text, voice, rate }) {
    const apiKey = process.env.GOOGLE_TTS_API_KEY
    if (!apiKey) throw new Error('GOOGLE_TTS_API_KEY missing')

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'ru-RU', name: voice },
          audioConfig: { audioEncoding: 'MP3', speakingRate: rate },
        }),
        signal: AbortSignal.timeout(2500),
      },
    )
    if (!response.ok) throw new Error(`Google TTS failed: ${response.status}`)
    const json = (await response.json()) as { audioContent: string }
    const buffer = Buffer.from(json.audioContent, 'base64')
    return { buffer, mimeType: 'audio/mpeg' }
  },
}
