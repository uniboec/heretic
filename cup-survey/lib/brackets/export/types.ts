import type { BracketStructure, CategoryResult, OlympicBronzeMode } from '../core/types'
import type { BoutOutcomeDto } from '../buildBoutOutcomes'

export type BracketExportParticipant = {
  entryId: string
  seedPosition: number
  displayName: string
  clubName: string
  city?: string
}

export type BracketExportCategory = {
  categoryKey: string
  title: string
  discipline: string | null
  matIndex: number | null
  competitionStage: number
  effectiveSystemId: string | null
  effectiveBronzeMode?: OlympicBronzeMode | null
  participantCount: number
  structure: BracketStructure
  participants: BracketExportParticipant[]
  boutOutcomes: Record<string, BoutOutcomeDto>
  result: CategoryResult | null
  scheduleDisplayByBoutId?: Record<string, string>
  boutsReleased?: boolean
}

export type BracketPageOrientation = 'portrait' | 'landscape'

export type BracketCategoryPageLayout = {
  orientation: BracketPageOrientation
  /** Round ranges for olympic page splits, e.g. [[1,2],[3,4],[5,5]] */
  olympicRoundGroups?: Array<[number, number]>
  splitRoundRobinStandings?: boolean
}
