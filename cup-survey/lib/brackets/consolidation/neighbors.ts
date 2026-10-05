import { fseAgeDivisions, getAgeDivision } from '../../config/fseCategories'
import {
  getRegistrationCategoryKey,
  parseRegistrationCategoryKey,
  type RegistrationCategoryIdentity,
} from '../../registration/categoryIdentity'
import { compareBracketCategoryKeys, getNextAgeDivision } from '../../registration/categoryRules'
import type {
  ConsolidationAction,
  ConsolidationStep,
  ConsolidationStepType,
  WeightMappingMode,
} from './types'

function genderFromAgeDivisionId(ageDivisionId: string): 'male' | 'female' {
  return ageDivisionId.startsWith('f_') ? 'female' : 'male'
}

function getWeightIndex(ageDivisionId: string, weightCategoryId: string): number {
  const division = getAgeDivision(ageDivisionId)
  if (!division) return -1
  return division.weightCategories.findIndex((w) => w.id === weightCategoryId)
}

function mapWeightToDivision(
  sourceWeightId: string,
  sourceDivisionId: string,
  targetDivisionId: string,
  mode: WeightMappingMode,
): string | null {
  const sourceDivision = getAgeDivision(sourceDivisionId)
  const targetDivision = getAgeDivision(targetDivisionId)
  if (!sourceDivision || !targetDivision) return null

  if (mode === 'SAME_INDEX') {
    const sourceIndex = sourceDivision.weightCategories.findIndex((w) => w.id === sourceWeightId)
    if (sourceIndex < 0) return null
    const clamped = Math.min(sourceIndex, targetDivision.weightCategories.length - 1)
    return targetDivision.weightCategories[clamped]?.id ?? null
  }

  const sourceWeight = sourceDivision.weightCategories.find((w) => w.id === sourceWeightId)
  if (!sourceWeight) return null
  const sourceKg = sourceWeight.maxWeight ?? sourceWeight.minWeight
  if (sourceKg == null) return null

  let best = targetDivision.weightCategories[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const weight of targetDivision.weightCategories) {
    const kg = weight.maxWeight ?? weight.minWeight
    if (kg == null) continue
    const distance = Math.abs(kg - sourceKg)
    if (distance < bestDistance) {
      bestDistance = distance
      best = weight
    }
  }
  return best?.id ?? null
}

function withIdentity(
  identity: RegistrationCategoryIdentity,
  patch: Partial<RegistrationCategoryIdentity>,
): RegistrationCategoryIdentity {
  return { ...identity, ...patch }
}

function applySingleHop(
  identity: RegistrationCategoryIdentity,
  type: ConsolidationStepType,
  weightMapping: WeightMappingMode,
): RegistrationCategoryIdentity | null {
  switch (type) {
    case 'WEIGHT_UP':
    case 'WEIGHT_DOWN': {
      const division = getAgeDivision(identity.ageDivisionId)
      if (!division) return null
      const index = getWeightIndex(identity.ageDivisionId, identity.weightCategoryId)
      if (index < 0) return null
      const nextIndex = type === 'WEIGHT_UP' ? index + 1 : index - 1
      const nextWeight = division.weightCategories[nextIndex]
      if (!nextWeight) return null
      return withIdentity(identity, { weightCategoryId: nextWeight.id })
    }
    case 'AGE_UP': {
      const gender = genderFromAgeDivisionId(identity.ageDivisionId)
      const nextDivision = getNextAgeDivision(identity.ageDivisionId, gender)
      if (!nextDivision) return null
      const mappedWeight = mapWeightToDivision(
        identity.weightCategoryId,
        identity.ageDivisionId,
        nextDivision.id,
        weightMapping,
      )
      if (!mappedWeight) return null
      return withIdentity(identity, {
        ageDivisionId: nextDivision.id,
        weightCategoryId: mappedWeight,
      })
    }
    case 'EXPERIENCE_UP': {
      if (identity.experienceLevel !== 'novice') return null
      return withIdentity(identity, { experienceLevel: 'experienced' })
    }
    default:
      return null
  }
}

export function applyConsolidationAction(
  identity: RegistrationCategoryIdentity,
  action: ConsolidationAction,
): RegistrationCategoryIdentity | null {
  const repeat = action.repeat ?? 1
  const weightMapping = action.weightMapping ?? 'SAME_INDEX'
  let current = identity
  for (let index = 0; index < repeat; index += 1) {
    const next = applySingleHop(current, action.type, weightMapping)
    if (!next) return null
    current = next
  }
  return current
}

export function applyActionChain(
  identity: RegistrationCategoryIdentity,
  actions: ConsolidationAction[],
): RegistrationCategoryIdentity | null {
  let current = identity
  for (const action of actions) {
    const next = applyConsolidationAction(current, action)
    if (!next) return null
    current = next
  }
  return current
}

export function buildCandidateKeysForStep(sourceKey: string, step: ConsolidationStep): string[] {
  const identity = parseRegistrationCategoryKey(sourceKey)
  if (!identity) return []

  const result = applyActionChain(identity, step.actions)
  if (!result) return []

  return [getRegistrationCategoryKey(result)]
}

export function getAgeDivisionSortIndex(ageDivisionId: string): number {
  const index = fseAgeDivisions.findIndex((division) => division.id === ageDivisionId)
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER
}

export function getWeightSortIndex(ageDivisionId: string, weightCategoryId: string): number {
  const index = getWeightIndex(ageDivisionId, weightCategoryId)
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER
}

export function compareCategoryIdentity(a: string, b: string): number {
  return compareBracketCategoryKeys(a, b)
}

export function stepTypeLabel(type: ConsolidationStepType): string {
  return type
}
