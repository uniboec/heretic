import { tournamentDisciplines } from '@/lib/config/tournament'
import { genderOptions } from '@/lib/config/tournament'
import { fseAgeDivisions, formatAgeDivisionFilterLabel } from '@/lib/config/fseCategories'
import { experienceLevelOptions } from '@/lib/config/experienceLevel'
import {
  getRegistrationCategoryKey,
  parseRegistrationCategoryKey,
} from '@/lib/registration/categoryIdentity'
import {
  compareBracketCategoryKeys,
  getWeightCategoriesForDivision,
} from '@/lib/registration/categoryRules'
import { formatParticipantCount } from '@/lib/brackets/labels'

export type MoveTargetSelection = {
  discipline: string
  experienceLevel: string
  ageDivisionId: string
  weightCategoryId: string
}

export type MoveTargetCategoryKeyItem = {
  key: string
  title: string
  participantCount: number
}

export type MoveTargetOptionWithCount = {
  id: string
  label: string
  count: number
}

export type MoveTargetWeightOption = MoveTargetOptionWithCount & {
  weightCategoryId: string
  categoryKey: string
}

export type MoveTargetSummary = {
  currentCount: number
  afterCount: number
  willCreateCategory: boolean
}

const EXPERIENCE_LEVEL_ALIASES: Record<string, string> = {
  beginner: 'novice',
}

function normalizeExperienceLevelId(id: string): string {
  return EXPERIENCE_LEVEL_ALIASES[id] ?? id
}

function genderFromAgeDivisionId(ageDivisionId: string): 'male' | 'female' {
  return ageDivisionId.startsWith('f_') ? 'female' : 'male'
}

function normalizeWeightCategoryId(ageDivisionId: string, weightCategoryId: string): string {
  const legacyMatch = weightCategoryId.match(/^w_(\d+\+?)$/)
  if (!legacyMatch) return weightCategoryId

  const legacyValue = legacyMatch[1]
  const division = fseAgeDivisions.find((item) => item.id === ageDivisionId)
  if (!division) return weightCategoryId

  const leCandidate = `${ageDivisionId}_w_le_${legacyValue}`
  if (division.weightCategories.some((weight) => weight.id === leCandidate)) {
    return leCandidate
  }

  const gtCandidate = `${ageDivisionId}_w_gt_${legacyValue.replace('+', '')}`
  if (division.weightCategories.some((weight) => weight.id === gtCandidate)) {
    return gtCandidate
  }

  return weightCategoryId
}

function matchesMoveTargetFilter(
  identity: {
    discipline: string
    experienceLevel: string
    ageDivisionId: string
    weightCategoryId: string
  },
  athleteGender: 'male' | 'female',
  filter: Partial<MoveTargetSelection>,
): boolean {
  if (genderFromAgeDivisionId(identity.ageDivisionId) !== athleteGender) return false
  if (filter.discipline && identity.discipline !== filter.discipline) return false
  if (
    filter.experienceLevel &&
    normalizeExperienceLevelId(identity.experienceLevel) !==
      normalizeExperienceLevelId(filter.experienceLevel)
  ) {
    return false
  }
  if (filter.ageDivisionId && identity.ageDivisionId !== filter.ageDivisionId) return false
  if (filter.weightCategoryId) {
    const ageDivisionId = filter.ageDivisionId ?? identity.ageDivisionId
    const identityWeight = normalizeWeightCategoryId(ageDivisionId, identity.weightCategoryId)
    const filterWeight = normalizeWeightCategoryId(ageDivisionId, filter.weightCategoryId)
    if (identityWeight !== filterWeight) return false
  }
  return true
}

export function overlayAllCategoryKeysWithLiveCategories(
  allCategoryKeys: MoveTargetCategoryKeyItem[],
  categories: Array<{ categoryKey: string; title: string; participants: unknown[] }>,
): MoveTargetCategoryKeyItem[] {
  const map = new Map(allCategoryKeys.map((item) => [item.key, { ...item }]))

  for (const category of categories) {
    map.set(category.categoryKey, {
      key: category.categoryKey,
      title: category.title,
      participantCount: category.participants.length,
    })
  }

  return [...map.values()].sort((a, b) => compareBracketCategoryKeys(a.key, b.key))
}

export function countParticipantsInMoveTargetSnapshot(
  allCategoryKeys: MoveTargetCategoryKeyItem[],
  athleteGender: 'male' | 'female',
  filter: Partial<MoveTargetSelection>,
): number {
  let total = 0
  for (const item of allCategoryKeys) {
    const identity = parseRegistrationCategoryKey(item.key)
    if (!identity) continue
    if (!matchesMoveTargetFilter(identity, athleteGender, filter)) continue
    total += item.participantCount
  }
  return total
}

export function emptyMoveTargetSelection(): MoveTargetSelection {
  return {
    discipline: '',
    experienceLevel: '',
    ageDivisionId: '',
    weightCategoryId: '',
  }
}

export function patchMoveTargetSelection(
  selection: MoveTargetSelection,
  field: keyof MoveTargetSelection,
  value: string,
): MoveTargetSelection {
  const next = { ...selection, [field]: value }
  if (field === 'discipline' && value !== selection.discipline) {
    next.experienceLevel = ''
    next.ageDivisionId = ''
    next.weightCategoryId = ''
  }
  if (field === 'experienceLevel' && value !== selection.experienceLevel) {
    next.ageDivisionId = ''
    next.weightCategoryId = ''
  }
  if (field === 'ageDivisionId' && value !== selection.ageDivisionId) {
    next.weightCategoryId = ''
  }
  return next
}

export function resolveMoveTargetCategoryKey(
  selection: MoveTargetSelection,
  athleteGender: 'male' | 'female',
): string | null {
  const { discipline, experienceLevel, ageDivisionId, weightCategoryId } = selection
  if (!discipline || !experienceLevel || !ageDivisionId || !weightCategoryId) return null

  const division = fseAgeDivisions.find((item) => item.id === ageDivisionId)
  if (!division || division.gender !== athleteGender) return null

  return getRegistrationCategoryKey({
    discipline,
    experienceLevel,
    ageDivisionId,
    weightCategoryId,
  })
}

/** @deprecated Prefer countParticipantsInMoveTargetSnapshot for partial filters. */
export function getMoveTargetParticipantCount(
  key: string,
  allCategoryKeys: MoveTargetCategoryKeyItem[],
): number {
  return allCategoryKeys.find((item) => item.key === key)?.participantCount ?? 0
}

export function buildDisciplineOptionsWithCounts(
  athleteGender: 'male' | 'female',
  allCategoryKeys: MoveTargetCategoryKeyItem[],
): MoveTargetOptionWithCount[] {
  return tournamentDisciplines.map((discipline) => ({
    id: discipline.id,
    label: discipline.label,
    count: countParticipantsInMoveTargetSnapshot(allCategoryKeys, athleteGender, {
      discipline: discipline.id,
    }),
  }))
}

export function buildExperienceLevelOptionsWithCounts(
  selection: MoveTargetSelection,
  athleteGender: 'male' | 'female',
  allCategoryKeys: MoveTargetCategoryKeyItem[],
): MoveTargetOptionWithCount[] {
  if (!selection.discipline) return []

  return experienceLevelOptions.map((level) => ({
    id: level.id,
    label: level.label,
    count: countParticipantsInMoveTargetSnapshot(allCategoryKeys, athleteGender, {
      discipline: selection.discipline,
      experienceLevel: level.id,
    }),
  }))
}

export function buildAgeDivisionOptionsWithCounts(
  selection: MoveTargetSelection,
  athleteGender: 'male' | 'female',
  allCategoryKeys: MoveTargetCategoryKeyItem[],
): MoveTargetOptionWithCount[] {
  if (!selection.discipline || !selection.experienceLevel) return []

  return getAgeDivisionOptionsForGender(athleteGender).map((division) => ({
    id: division.id,
    label: formatAgeDivisionOptionLabel(division.id),
    count: countParticipantsInMoveTargetSnapshot(allCategoryKeys, athleteGender, {
      discipline: selection.discipline,
      experienceLevel: selection.experienceLevel,
      ageDivisionId: division.id,
    }),
  }))
}

export function buildWeightOptionsWithCounts(
  selection: MoveTargetSelection,
  athleteGender: 'male' | 'female',
  allCategoryKeys: MoveTargetCategoryKeyItem[],
): MoveTargetWeightOption[] {
  if (!selection.discipline || !selection.experienceLevel || !selection.ageDivisionId) {
    return []
  }

  return getWeightCategoriesForDivision(selection.ageDivisionId).map((weight) => {
    const categoryKey =
      resolveMoveTargetCategoryKey(
        { ...selection, weightCategoryId: weight.id },
        athleteGender,
      ) ?? ''
    return {
      id: weight.id,
      weightCategoryId: weight.id,
      label: weight.label,
      count: countParticipantsInMoveTargetSnapshot(allCategoryKeys, athleteGender, {
        discipline: selection.discipline,
        experienceLevel: selection.experienceLevel,
        ageDivisionId: selection.ageDivisionId,
        weightCategoryId: weight.id,
      }),
      categoryKey,
    }
  })
}

export function getMoveTargetSummary(
  selection: MoveTargetSelection,
  athleteGender: 'male' | 'female',
  allCategoryKeys: MoveTargetCategoryKeyItem[],
  currentCategoryKey: string,
): MoveTargetSummary | null {
  const categoryKey = resolveMoveTargetCategoryKey(selection, athleteGender)
  if (!categoryKey || categoryKey === currentCategoryKey) return null

  const currentCount = countParticipantsInMoveTargetSnapshot(allCategoryKeys, athleteGender, selection)
  return {
    currentCount,
    afterCount: currentCount + 1,
    willCreateCategory: currentCount === 0,
  }
}

export function isMoveTargetReady(
  selection: MoveTargetSelection,
  athleteGender: 'male' | 'female',
  currentCategoryKey: string,
): boolean {
  const categoryKey = resolveMoveTargetCategoryKey(selection, athleteGender)
  return Boolean(categoryKey && categoryKey !== currentCategoryKey)
}

export function getAthleteGenderLabel(gender: 'male' | 'female'): string {
  return genderOptions.find((option) => option.id === gender)?.label ?? gender
}

export function getAgeDivisionOptionsForGender(gender: 'male' | 'female') {
  return fseAgeDivisions.filter((division) => division.gender === gender)
}

export function getDisciplineOptions() {
  return tournamentDisciplines
}

export function getExperienceLevelOptions() {
  return experienceLevelOptions
}

export function formatAgeDivisionOptionLabel(ageDivisionId: string): string {
  const division = fseAgeDivisions.find((item) => item.id === ageDivisionId)
  if (!division) return ageDivisionId
  return formatAgeDivisionFilterLabel(division)
}

export function parseMoveTargetFromCategoryKey(categoryKey: string): MoveTargetSelection | null {
  const identity = parseRegistrationCategoryKey(categoryKey)
  if (!identity) return null
  return {
    discipline: identity.discipline,
    experienceLevel: identity.experienceLevel,
    ageDivisionId: identity.ageDivisionId,
    weightCategoryId: identity.weightCategoryId,
  }
}

export function formatMoveTargetOptionLabel(label: string, count: number): string {
  return `${label} — ${formatParticipantCount(count)}`
}
