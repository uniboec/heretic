import type {
  ConsolidationAction,
  ConsolidationPolicy,
  ConsolidationStep,
  ConsolidationStepType,
} from '@/lib/brackets/consolidation/types'
import {
  normalizePolicy,
  normalizeStep,
  validateStepActions,
} from '@/lib/brackets/consolidation/policyHash'

const STEP_TYPES: ConsolidationStepType[] = [
  'WEIGHT_UP',
  'WEIGHT_DOWN',
  'AGE_UP',
  'EXPERIENCE_UP',
]

export const DEFAULT_CONSOLIDATION_POLICY: ConsolidationPolicy = normalizePolicy({
  incompleteThreshold: 1,
  steps: [
    { enabled: true, actions: [{ type: 'EXPERIENCE_UP' }] },
    { enabled: true, actions: [{ type: 'WEIGHT_UP' }] },
    { enabled: true, actions: [{ type: 'AGE_UP', weightMapping: 'SAME_INDEX' }] },
  ],
})

function parseAction(raw: unknown): ConsolidationAction | null {
  if (!raw || typeof raw !== 'object') return null
  const action = raw as ConsolidationAction
  if (!STEP_TYPES.includes(action.type)) return null
  return action
}

function parseStep(raw: unknown): ConsolidationStep | null {
  if (!raw || typeof raw !== 'object') return null
  return normalizeStep(raw as ConsolidationStep & { type?: ConsolidationStepType })
}

export function parseConsolidationPolicy(raw: unknown): ConsolidationPolicy {
  if (!raw || typeof raw !== 'object') return DEFAULT_CONSOLIDATION_POLICY
  const value = raw as Partial<ConsolidationPolicy>
  const threshold = value.incompleteThreshold
  const incompleteThreshold =
    threshold === 1 || threshold === 2 || threshold === 3 ? threshold : 1
  const steps = Array.isArray(value.steps)
    ? value.steps
        .map(parseStep)
        .filter((step): step is ConsolidationStep => step != null)
    : DEFAULT_CONSOLIDATION_POLICY.steps

  return normalizePolicy({
    incompleteThreshold,
    steps: steps.length > 0 ? steps : DEFAULT_CONSOLIDATION_POLICY.steps,
  })
}

export function hasActiveConsolidationWaves(policy: ConsolidationPolicy): boolean {
  return policy.steps.some((step) => step.enabled)
}

export function validateStepActionsClient(actions: ConsolidationAction[]): string | null {
  return validateStepActions(actions)
}

export function createSingleActionWave(type: ConsolidationStepType): ConsolidationStep {
  return normalizeStep({
    enabled: true,
    actions: [
      type === 'AGE_UP'
        ? { type, weightMapping: 'SAME_INDEX' as const }
        : { type },
    ],
  })!
}

export function createPresetWave(preset: 'experience_weight' | 'age_weight' | 'weight_x2'): ConsolidationStep {
  switch (preset) {
    case 'experience_weight':
      return normalizeStep({
        enabled: true,
        actions: [{ type: 'EXPERIENCE_UP' }, { type: 'WEIGHT_UP' }],
      })!
    case 'age_weight':
      return normalizeStep({
        enabled: true,
        actions: [
          { type: 'AGE_UP', weightMapping: 'SAME_INDEX' },
          { type: 'WEIGHT_UP' },
        ],
      })!
    case 'weight_x2':
      return normalizeStep({
        enabled: true,
        actions: [{ type: 'WEIGHT_UP', repeat: 2 }],
      })!
  }
}

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

export function getAvailableActionTypes(actions: ConsolidationAction[]): ConsolidationStepType[] {
  const usedAxes = new Set(actions.map((action) => actionAxis(action.type)))
  return STEP_TYPES.filter((type) => !usedAxes.has(actionAxis(type)))
}
