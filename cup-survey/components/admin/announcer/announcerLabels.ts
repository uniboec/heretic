import type { AnnouncerEventStatus, AnnouncerMode } from '@prisma/client'

export const ANNOUNCER_MODE_LABELS: Record<AnnouncerMode, string> = {
  AUTO: 'Авто',
  MANUAL: 'Вручную',
  PAUSED: 'Пауза',
}

export const ANNOUNCER_EVENT_STATUS_LABELS: Record<AnnouncerEventStatus, string> = {
  QUEUED: 'В очереди',
  GENERATING: 'Генерация',
  READY: 'Готово',
  PLAYING: 'Играет',
  PLAYED: 'Сыграно',
  SKIPPED: 'Пропущено',
  EXPIRED: 'Устарело',
  FAILED: 'Ошибка',
}
