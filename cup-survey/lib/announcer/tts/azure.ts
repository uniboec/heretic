import type { TtsProvider, TtsVoice } from './types'

const DEFAULT_VOICES: TtsVoice[] = [
  { id: 'ru-RU-DmitryNeural', name: 'Dmitry Neural' },
  { id: 'ru-RU-SvetlanaNeural', name: 'Svetlana Neural' },
]

function azureSpeechKeys(): string[] {
  return [process.env.AZURE_SPEECH_KEY, process.env.AZURE_SPEECH_KEY_FALLBACK].filter(
    (key): key is string => Boolean(key?.trim()),
  )
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildSsml(text: string, voice: string, rate: number): string {
  const pct = Math.round((rate - 1) * 100)
  const rateAttr = pct === 0 ? '' : ` rate="${pct > 0 ? '+' : ''}${pct}%"`
  return `<speak version="1.0" xml:lang="ru-RU"><voice name="${voice}"${rateAttr}>${escapeXml(text)}</voice></speak>`
}

export const azureTtsProvider: TtsProvider = {
  id: 'azure',
  async getVoices() {
    return DEFAULT_VOICES
  },
  async healthCheck() {
    const region = process.env.AZURE_SPEECH_REGION
    const keys = azureSpeechKeys()
    return Boolean(region && keys.length > 0)
  },
  async synthesize({ text, voice, rate }) {
    const region = process.env.AZURE_SPEECH_REGION
    const keys = azureSpeechKeys()
    if (!region || keys.length === 0) throw new Error('Azure speech env missing')

    let lastError: unknown
    for (const key of keys) {
      try {
        const response = await fetch(
          `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
          {
            method: 'POST',
            headers: {
              'Ocp-Apim-Subscription-Key': key,
              'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
            },
            body: buildSsml(text, voice, rate),
            signal: AbortSignal.timeout(15_000),
          },
        )
        if (!response.ok) throw new Error(`Azure TTS failed: ${response.status}`)
        const buffer = Buffer.from(await response.arrayBuffer())
        return { buffer, mimeType: 'audio/mpeg' }
      } catch (error) {
        lastError = error
      }
    }

    throw lastError ?? new Error('Azure TTS failed')
  },
}
