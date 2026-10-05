import { azureTtsProvider } from './azure'
import { edgeTtsProvider } from './edge'
import { googleTtsProvider } from './google'
import { piperTtsProvider } from './piper'
import { sileroTtsProvider } from './silero'
import type { TtsProvider } from './types'
import { yandexTtsProvider } from './yandex'

const PROVIDERS: TtsProvider[] = [
  yandexTtsProvider,
  azureTtsProvider,
  googleTtsProvider,
  piperTtsProvider,
  sileroTtsProvider,
  edgeTtsProvider,
]

export function getTtsProvider(id: string): TtsProvider | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

export function listTtsProviders(): TtsProvider[] {
  return PROVIDERS
}

export function listTtsProviderIds(): string[] {
  return PROVIDERS.map((p) => p.id)
}

export function defaultVoiceForProvider(providerId: string): string {
  switch (providerId) {
    case 'yandex':
      return 'marina'
    case 'azure':
      return 'ru-RU-DmitryNeural'
    case 'google':
      return 'ru-RU-Wavenet-D'
    case 'piper':
      return 'dmitri'
    case 'silero':
      return 'ru_v3'
    case 'edge':
      return 'ru-RU-DmitryNeural'
    default:
      return 'default'
  }
}
