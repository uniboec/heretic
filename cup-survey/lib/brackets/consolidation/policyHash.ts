import { stableJsonHash } from '../live/mutationFingerprint'
import type {
  ConsolidationAction,
  ConsolidationPolicy,
  ConsolidationStep,
  ConsolidationStepType,
  LegacyConsolidationPolicyInput,
  LegacyConsolidationStepInput,
  WeightMappingMode,
} from './types'

const STEP_TYPES: ConsolidationStepType[] = [
  'WEIGHT_UP',
  'WEIGHT_DOWN',
  'AGE_UP',
  'EXPERIENCE_UP',
]

type ConsolidationAxis = 'weight' | 'age' | 'experience'

function actionAxis(type: ConsolidationStepType): ConsolidationAxis {
  switch (type) {
    case 'WEIGHT_UP':
    case 'WEIGHT_DOWN':
      return 'weight'
    case 'AGE_UP':
      return 'age'
    case 'EXPERIENCE_UP':
      return 'experience'
  }
}

export function getStepPrimaryActionType(step: ConsolidationStep): ConsolidationStepType {
  return step.actions[0]?.type ?? 'WEIGHT_UP'
}

export function normalizeAction(action: ConsolidationAction): ConsolidationAction {
  if (!STEP_TYPES.includes(action.type)) {
    return { type: 'WEIGHT_UP' }
  }

  const normalized: ConsolidationAction = { type: action.type }
  const repeat = action.repeat === 2 || action.repeat === 3 ? action.repeat : undefined
  if (repeat && action.type !== 'EXPERIENCE_UP') {
    normalized.repeat = repeat
  }
  if (action.type === 'AGE_UP') {
    normalized.weightMapping = action.weightMapping ?? 'SAME_INDEX'
  }
  return normalized
}

export function validateStepActions(actions: ConsolidationAction[]): string | null {
  if (actions.length < 1 || actions.length > 3) {
    return 'INVALID_ACTIONS_LENGTH'
  }

  const axes = new Set<ConsolidationAxis>()
  let hasWeightUp = false
  let hasWeightDown = false

  for (const action of actions) {
    if (!STEP_TYPES.includes(action.type)) {
      return 'INVALID_ACTION_TYPE'
    }

    if (action.type === 'WEIGHT_UP') hasWeightUp = true
    if (action.type === 'WEIGHT_DOWN') hasWeightDown = true
    if (hasWeightUp && hasWeightDown) {
      return 'CONFLICTING_WEIGHT'
    }

    const axis = actionAxis(action.type)
    if (axes.has(axis)) {
      return 'DUPLICATE_AXIS'
    }
    axes.add(axis)

    if (action.repeat != null && action.repeat !== 1 && action.repeat !== 2 && action.repeat !== 3) {
      return 'INVALID_REPEAT'
    }
    if (action.repeat != null && action.repeat > 1 && action.type === 'EXPERIENCE_UP') {
      return 'INVALID_REPEAT'
    }
    if (
      action.repeat != null &&
      action.repeat > 1 &&
      action.type !== 'WEIGHT_UP' &&
      action.type !== 'WEIGHT_DOWN' &&
      action.type !== 'AGE_UP'
    ) {
      return 'INVALID_REPEAT'
    }
  }

  if (hasWeightUp && hasWeightDown) {
    return 'CONFLICTING_WEIGHT'
  }

  return null
}

function parseLegacyActions(raw: LegacyConsolidationStepInput): ConsolidationAction[] | null {
  if (Array.isArray(raw.actions) && raw.actions.length > 0) {
    return raw.actions
  }
  if (raw.type && STEP_TYPES.includes(raw.type)) {
    return [
      {
        type: raw.type,
        ...(raw.type === 'AGE_UP'
          ? { weightMapping: raw.weightMapping ?? 'SAME_INDEX' }
          : {}),
      },
    ]
  }
  return null
}

export function normalizeStep(raw: LegacyConsolidationStepInput): ConsolidationStep | null {
  const parsedActions = parseLegacyActions(raw)
  if (!parsedActions) return null

  const actions = parsedActions.map(normalizeAction)
  if (validateStepActions(actions)) return null

  return {
    enabled: Boolean(raw.enabled),
    actions,
  }
}

export function normalizePolicy(
  policy: ConsolidationPolicy | LegacyConsolidationPolicyInput,
): ConsolidationPolicy {
  const threshold = policy.incompleteThreshold
  const incompleteThreshold =
    threshold === 1 || threshold === 2 || threshold === 3 ? threshold : 1

  const steps: ConsolidationStep[] = []
  for (const step of policy.steps) {
    const normalized = normalizeStep(step as LegacyConsolidationStepInput)
    if (normalized) steps.push(normalized)
  }

  return {
    incompleteThreshold,
    steps,
  }
}

export function hashPolicy(policy: ConsolidationPolicy): string {
  return stableJsonHash(normalizePolicy(policy))
}

export function validateConsolidationPolicy(input: unknown): ConsolidationPolicy | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Partial<ConsolidationPolicy>
  const threshold = value.incompleteThreshold
  if (threshold !== 1 && threshold !== 2 && threshold !== 3) return null
  if (!Array.isArray(value.steps) || value.steps.length < 1) return null

  const steps: ConsolidationStep[] = []
  for (const step of value.steps) {
    if (!step || typeof step !== 'object') return null
    const normalized = normalizeStep(step as LegacyConsolidationStepInput)
    if (!normalized) return null
    steps.push(normalized)
  }

  if (!steps.some((step) => step.enabled)) return null

  return normalizePolicy({
    incompleteThreshold: threshold,
    steps,
  })
}
