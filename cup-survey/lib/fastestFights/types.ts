import type { SubmissionSubtype } from '@/lib/config/fseRules'

export type FastestFightRow = {
  rank: number
  boutId: string
  scheduleDisplayNumber: string
  displayName: string
  clubName: string
  city: string
  boutElapsedMs: number
  timeLabel: string
  victoryMethod: string
  victoryMethodLabel: string
  categoryTitle: string
  discipline: string
  confirmedAt: string
}

export type FastestFightsResponse = {
  published: boolean
  publishedAt: string | null
  rows: FastestFightRow[]
  totalEligible: number
}

export type FastestFightBoutResultInput = {
  boutId: string
  winnerEntryId: string | null
  victoryMethod: string
  submissionSubtype?: SubmissionSubtype
  boutElapsedMs: number | null
  resultConfirmedAt: Date
}

export type FastestFightParticipant = {
  entryId: string
  displayName: string
  clubName: string
  city: string
}

export type FastestFightBoutMeta = {
  boutId: string
  scheduleDisplayNumber: string
  categoryTitle: string
  discipline: string
}
