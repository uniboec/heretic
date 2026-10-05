export type OlympicBronzeMode = 'ONE' | 'TWO'

export interface BracketSlotSource {
  matchId: string
  outcome: 'winner' | 'loser'
}

export type BracketCategoryStatus = 'ACTIVE' | 'INACTIVE' | 'UNSUPPORTED'

export type BracketCategoryStatusReason =
  | 'NO_FORMAT_RULE'
  | 'EXCEEDS_MAX_PARTICIPANTS'
  | 'SYSTEM_UNAVAILABLE'

export interface ValidationIssue {
  code: string
  message: string
  categoryKey?: string
}

export interface BracketParticipantInput {
  entryId: string
  displayName: string
  clubName: string
  city: string
  clubIdentity: string
  publicNumber: number | null
  seedPosition: number
  seedLocked: boolean
  strengthTier?: number | null
  clubKey?: string | null
  cityKey?: string | null
}

export interface SystemOptions {
  bronzeMode: OlympicBronzeMode | null
}

export interface SystemBuildInput {
  participants: BracketParticipantInput[]
  drawSeed: string
  options: SystemOptions
}

export interface BracketRoundMatch {
  id: string
  round: number
  /** Позиция матча в раунде сверху вниз (1…N). */
  slot: number
  /** Сквозной номер боя в сетке на выбывание (1…B−1), B — размер сетки. */
  matchNumber: number
  participantA: BracketParticipantInput | null
  participantB: BracketParticipantInput | null
  /** Подпись для UI; для финала обычно не задаётся (заголовок колонки). */
  label?: string
  /** Участник определяется по исходу предыдущего боя (трёхучастниковая система). */
  slotHintA?: string
  slotHintB?: string
  slotSourceA?: BracketSlotSource
  slotSourceB?: BracketSlotSource
  winnerEntryId?: string | null
  loserEntryId?: string | null
}

export type PlacementReason =
  | 'SINGLE_PARTICIPANT'
  | 'FINAL_WINNER'
  | 'FINAL_LOSER'
  | 'BRONZE_WINNER'
  | 'BRONZE_TWO'
  | 'THREE_WAY_BRONZE'
  | 'ROUND_ROBIN_STANDING'

export type CategoryResultStatus = 'in_progress' | 'complete'

export interface CategoryPlacement {
  entryId: string
  placement: number
  reason: PlacementReason
  provisional?: boolean
}

export interface CategoryResult {
  status: CategoryResultStatus
  placements: CategoryPlacement[]
}

export interface BracketStructure {
  systemId: string
  systemVersion: number
  rounds: BracketRoundMatch[]
  bronzeSlots?: Array<{
    id: string
    /** Заголовок блока или подпись слота (как «Победитель боя N» в сетке). */
    label: string
    /** Участники боя за 3-е место (режим ONE). */
    hintA?: string
    hintB?: string
    entryIdA?: string
    entryIdB?: string
    sourceA?: BracketSlotSource
    sourceB?: BracketSlotSource
    winnerEntryId?: string | null
    loserEntryId?: string | null
  }>
  roundRobinPairs?: Array<{
    entryIdA: string
    entryIdB: string
    /** Номер круга в расписании (служебное поле). */
    round: number
    /** Сквозной номер боя в сетке (1…N). */
    matchNumber?: number
    winnerEntryId?: string | null
    loserEntryId?: string | null
  }>
  roundRobinStandings?: Array<{
    entryId: string
    wins: number
    losses: number
    played: number
  }>
  /** Единственный участник (система champion). */
  champion?: {
    entryId: string
    displayName: string
    clubName: string
    city: string
    publicNumber: number | null
  }
  /** Подпись блока для UI (система champion). */
  label?: string
  /** Канонический результат категории. */
  result?: CategoryResult
}

export interface BracketSystem {
  id: string
  version: number
  label: string
  requiresFreshSeeding: boolean
  supportsBouts: boolean
  maxParticipants: number
  build(input: SystemBuildInput): BracketStructure
  validateCategory(n: number, options: SystemOptions): ValidationIssue[]
  supportedBronzeModes(n: number): OlympicBronzeMode[] | null
}

export interface BracketFormatRuleLike {
  id?: string
  minParticipants: number
  maxParticipants: number
  systemId: string
  defaultBronzeMode: OlympicBronzeMode | null
  allowedSystemIds: string[]
  sortOrder: number
  enabled: boolean
}

export interface CategoryFormatResult {
  status: BracketCategoryStatus
  statusReason?: BracketCategoryStatusReason
  rule?: BracketFormatRuleLike
  system?: BracketSystem
}

export interface BracketSourceCompositionEntry {
  entryId: string
  sourceCategoryKey: string
}

export interface BracketCategoryCompositionEntry {
  entryId: string
  effectiveCategoryKey: string
}

export interface BracketSeedingSnapshot {
  systemId: string
  systemVersion: number
  participants: Array<{
    entryId: string
    clubIdentity: string
    seedPosition: number
  }>
}

export interface DrawInputSnapshot {
  drawPolicyId: string
  drawPolicyVersion: number
  systemId: string
  systemVersion: number
  participants: Array<{
    entryId: string
    strengthTier: number | null
    clubKey: string | null
    cityKey: string | null
    drawPosition: number
    seedLocked: boolean
  }>
}

export interface EntryRef {
  entryId: string
  displayName: string
}

export interface MovedEntryRef {
  entryId: string
  fromCategoryKey: string
  toCategoryKey: string
}

export interface BracketDraftDiff {
  globalCompositionStale: boolean
  registrationDataStale: boolean
  eligibilityCriteriaStale: boolean
  categories: Record<
    string,
    {
      compositionStale: boolean
      seedingStale: boolean
      balanceStale: boolean
      added: EntryRef[]
      removed: EntryRef[]
      moved: MovedEntryRef[]
    }
  >
}

export interface EligibleEntry {
  entryId: string
  sourceCategoryKey: string
  effectiveCategoryKey: string
  clubIdentity: string
  displayName: string
  clubName: string
  city: string
  clubId: string | null
  rankId: string | null
  gender: 'male' | 'female'
  strengthTier: number | null
  clubKey: string | null
  cityKey: string | null
  publicNumber: number | null
  paymentStatus: string
}
