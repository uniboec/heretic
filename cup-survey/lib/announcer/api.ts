import { NextResponse } from 'next/server'
import type { ClaimPlaybackCode } from './types'

function networkErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('cause' in error)) return undefined
  const cause = error.cause
  if (cause && typeof cause === 'object' && 'code' in cause) {
    return String(cause.code)
  }
  return undefined
}

export function announcerErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Неизвестная ошибка'

  const code = networkErrorCode(error)
  if (error.message === 'fetch failed' && code === 'EACCES') {
    return 'Нет доступа к внешним TTS-сервисам (сеть заблокирована). Проверьте файрвол/VPN или запустите локальный Edge TTS.'
  }
  if (error.message === 'fetch failed') {
    return 'Не удалось подключиться к TTS-сервису. Проверьте интернет и настройки сети.'
  }
  if (error.message === 'Azure speech env missing') {
    return 'Azure Speech не настроен: добавьте AZURE_SPEECH_KEY и AZURE_SPEECH_REGION в .env'
  }
  if (error.message === 'YANDEX_SPEECH_API_KEY missing') {
    return 'Yandex SpeechKit не настроен: добавьте YANDEX_SPEECH_API_KEY в .env'
  }
  if (error.message === 'No TTS provider available') {
    return 'Ни один TTS-провайдер не доступен. Проверьте ключи в .env и сетевой доступ.'
  }

  return error.message
}

export function announcerErrorResponse(error: unknown) {
  if (error instanceof Error) {
    return NextResponse.json({ error: announcerErrorMessage(error) }, { status: 400 })
  }
  return NextResponse.json({ error: 'Неизвестная ошибка' }, { status: 500 })
}

export function claimCodeStatus(code: ClaimPlaybackCode): number {
  switch (code) {
    case 'DISABLED':
    case 'MODE_NOT_AUTO':
      return 403
    case 'ALREADY_PLAYING':
    case 'CLAIM_LOST':
      return 409
    case 'GAP_ACTIVE':
    case 'NO_EVENT':
      return 204
    default:
      return 400
  }
}
