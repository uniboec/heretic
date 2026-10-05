import type {
  AnnouncerEvent,
  AnnouncerEventStatus,
  AnnouncerEventType,
  AnnouncerMode,
  AnnouncerNameFormat,
  AnnouncerRule,
  AnnouncerSetting,
} from '@prisma/client'

export type {
  AnnouncerEvent,
  AnnouncerEventStatus,
  AnnouncerEventType,
  AnnouncerMode,
  AnnouncerNameFormat,
  AnnouncerRule,
  AnnouncerSetting,
}

export type ClaimPlaybackCode =
  | 'OK'
  | 'GAP_ACTIVE'
  | 'ALREADY_PLAYING'
  | 'NO_EVENT'
  | 'CLAIM_LOST'
  | 'DISABLED'
  | 'MODE_NOT_AUTO'

export type CueSnapshot = {
  soundId: string
  url: string
  durationMs: number
} | null

export type PlaybackSnapshot = {
  eventId: string
  claimToken: string
  leaseUntil: string
  cueToSpeechGapMs: number
  cueVolume: number
  cue: CueSnapshot
  speech: { url: string; durationMs: number | null }
  textSnapshot: string | null
}

export type BoutSidePayload = {
  corner: 'red' | 'blue'
  displayName: string
  clubName?: string
  city?: string
}

export type BoutCallPayload = {
  boutId: string
  matIndex: number
  categoryTitle?: string
  sideA: BoutSidePayload
  sideB: BoutSidePayload
  /** Повторный вызов одного спортсмена (ожидание / второй вызов). */
  repeatCorner?: 'red' | 'blue'
  repeatSide?: BoutSidePayload
  repeatEntryId?: string
}

export type BoutResultPayload = {
  boutId: string
  boutResultId: string
  matIndex: number
  winnerCorner: 'red' | 'blue'
  displayName: string
  clubName?: string
  city?: string
  victoryMethod: string
  categoryTitle?: string
}

export type AwardPlacementPayload = {
  placement: number
  displayName: string
  clubName?: string
  city?: string
  placementId?: string
}

export type AwardCallPayload = {
  queueId: string
  categoryTitle?: string
  placements: AwardPlacementPayload[]
  /** Повторное приглашение всей категории (вручную из админки). */
  repeatCategory?: boolean
  /** Повторный вызов одного медалиста. */
  repeatPlacementId?: string
  repeatPlacement?: AwardPlacementPayload
  /** Стабильный ключ ручного повтора для дедупликации в очереди. */
  repeatLogicalKey?: string
}

export const EVENT_TYPE_LABELS: Record<AnnouncerEventType, string> = {
  BOUT_CALL: 'Вызов на поединок',
  BOUT_PREPARE: 'Готовятся к поединку',
  BOUT_RESULT: 'Результат поединка',
  AWARD_CALL: 'Приглашение на награждение',
  AWARD_PREPARE: 'Готовятся к награждению',
}

export const DEFAULT_PRIORITIES: Record<AnnouncerEventType, number> = {
  BOUT_RESULT: 110,
  BOUT_CALL: 100,
  BOUT_PREPARE: 80,
  AWARD_CALL: 40,
  AWARD_PREPARE: 20,
}

/** Повторный вызов: ниже результата, выше обычного вызова и prepare. */
export const BOUT_REPEAT_CALL_PRIORITY = 105

/** Повторные объявления награждения: выше обычного AWARD_CALL, ниже результата боя. */
export const AWARD_REPEAT_CALL_PRIORITY = 45

export const DEFAULT_TTL_SECONDS: Record<AnnouncerEventType, number> = {
  BOUT_CALL: 75,
  BOUT_PREPARE: 150,
  BOUT_RESULT: 50,
  AWARD_CALL: 150,
  AWARD_PREPARE: 300,
}
