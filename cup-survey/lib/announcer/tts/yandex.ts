import type { TtsAudio, TtsProvider, TtsVoice } from './types'

/** Voices supported by SpeechKit API v1 (form-urlencoded). */
const V1_VOICE_IDS = new Set([
  'alena',
  'filipp',
  'ermil',
  'jane',
  'omazh',
  'zahar',
  'marina',
  'madi_ru',
])

const DEFAULT_VOICES: TtsVoice[] = [
  { id: 'marina', name: 'Марина (ж, по умолчанию)' },
  { id: 'alena', name: 'Алёна (ж)' },
  { id: 'jane', name: 'Джейн (ж)' },
  { id: 'omazh', name: 'Омаж (ж)' },
  { id: 'dasha', name: 'Даша (ж)' },
  { id: 'julia', name: 'Юлия (ж)' },
  { id: 'lera', name: 'Лера (ж)' },
  { id: 'masha', name: 'Маша (ж)' },
  { id: 'saule_ru', name: 'Сауле (ж)' },
  { id: 'zamira_ru', name: 'Замира (ж)' },
  { id: 'zhanar_ru', name: 'Жанар (ж)' },
  { id: 'yulduz_ru', name: 'Юлдуз (ж)' },
  { id: 'filipp', name: 'Филипп (м)' },
  { id: 'ermil', name: 'Ермил (м)' },
  { id: 'zahar', name: 'Захар (м)' },
  { id: 'alexander', name: 'Александр (м)' },
  { id: 'kirill', name: 'Кирилл (м)' },
  { id: 'anton', name: 'Антон (м)' },
  { id: 'madi_ru', name: 'Мади (м)' },
]

const V1_ENDPOINT = 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize'
const V3_ENDPOINT = 'https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis'

function yandexAuthHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Api-Key ${apiKey}`,
  }
  const folderId = process.env.YANDEX_SPEECH_FOLDER_ID?.trim()
  if (folderId) headers['x-folder-id'] = folderId
  return headers
}

async function synthesizeV1(
  apiKey: string,
  { text, voice, rate }: { text: string; voice: string; rate: number },
): Promise<TtsAudio> {
  const response = await fetch(V1_ENDPOINT, {
    method: 'POST',
    headers: {
      ...yandexAuthHeaders(apiKey),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      text,
      lang: 'ru-RU',
      voice,
      format: 'mp3',
      speed: String(rate),
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Yandex TTS v1 failed: ${response.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  return { buffer, mimeType: 'audio/mpeg' }
}

function extractV3AudioChunk(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const root = payload as Record<string, unknown>
  const fromResult = root.result as Record<string, unknown> | undefined
  const chunk =
    (root.audioChunk as Record<string, unknown> | undefined) ??
    (fromResult?.audioChunk as Record<string, unknown> | undefined)
  const data = chunk?.data
  return typeof data === 'string' && data.length > 0 ? data : undefined
}

async function synthesizeV3(
  apiKey: string,
  { text, voice, rate }: { text: string; voice: string; rate: number },
): Promise<TtsAudio> {
  const response = await fetch(V3_ENDPOINT, {
    method: 'POST',
    headers: {
      ...yandexAuthHeaders(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      hints: [{ voice }, { speed: String(rate) }],
      outputAudioSpec: {
        containerAudio: { containerAudioType: 'MP3' },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Yandex TTS v3 failed: ${response.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`)
  }
  const payload = await response.json()
  const audioBase64 = extractV3AudioChunk(payload)
  if (!audioBase64) throw new Error('Yandex TTS v3 returned no audio')
  const buffer = Buffer.from(audioBase64, 'base64')
  return { buffer, mimeType: 'audio/mpeg' }
}

export const yandexTtsProvider: TtsProvider = {
  id: 'yandex',
  async getVoices() {
    return DEFAULT_VOICES
  },
  async healthCheck() {
    return Boolean(process.env.YANDEX_SPEECH_API_KEY)
  },
  async synthesize({ text, voice, rate }) {
    const apiKey = process.env.YANDEX_SPEECH_API_KEY
    if (!apiKey) throw new Error('YANDEX_SPEECH_API_KEY missing')

    if (V1_VOICE_IDS.has(voice)) {
      return synthesizeV1(apiKey, { text, voice, rate })
    }
    return synthesizeV3(apiKey, { text, voice, rate })
  },
}
