import type { AnnouncerEvent, AnnouncerRule, AnnouncerSetting } from '@prisma/client'

export type AnnouncerDashboardDto = {
  settings: AnnouncerSetting
  rules: AnnouncerRule[]
  playing: AnnouncerEvent | null
  queue: AnnouncerEvent[]
  history: AnnouncerEvent[]
  stats: {
    playedCount: number
    estimatedSpeechSeconds: number
    estimatedCharCount: number
    estimatedCostRub: number
  }
  serverTime: string
}
