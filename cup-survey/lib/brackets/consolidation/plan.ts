import type { BracketFormatRuleLike } from '../core/types'
import { buildCandidateKeysForStep } from './neighbors'
import {
  assertGroupEligibleForTarget,
  stepAllowsTarget,
  type ConsolidationAthleteContext,
} from './eligibility'
import { normalizeAction, normalizePolicy } from './policyHash'
import { exceedsFormatMax, rankTargetCandidates } from './rankCandidates'
import { sortSourcesForStep } from './semanticOrder'
import type {
  ConsolidationPlan,
  ConsolidationPolicy,
  ConsolidationSkipReason,
  ConsolidationStep,
  VirtualComposition,
} from './types'

function cloneVirtual(composition: VirtualComposition): VirtualComposition {
  const next = new Map<string, string[]>()
  for (const [key, entryIds] of composition) {
    next.set(key, [...entryIds])
  }
  return next
}

function isIncomplete(count: number, threshold: number): boolean {
  return count > 0 && count <= threshold
}

function collectAffectedKeys(plan: Pick<ConsolidationPlan, 'trace' | 'finalPlacements'>): string[] {
  const keys = new Set<string>()
  for (const hop of plan.trace) {
    keys.add(hop.fromCategoryKey)
    keys.add(hop.toCategoryKey)
  }
  for (const placement of plan.finalPlacements) {
    keys.add(placement.fromCategoryKey)
    keys.add(placement.finalCategoryKey)
  }
  return [...keys].sort()
}

function buildTraceHop(input: {
  hopIndex: number
  stepIndex: number
  entryIds: string[]
  fromCategoryKey: string
  toCategoryKey: string
  step: ConsolidationStep
}): ConsolidationPlan['trace'][number] {
  const actions = input.step.actions.map(normalizeAction)
  return {
    hopIndex: input.hopIndex,
    stepIndex: input.stepIndex,
    entryIds: input.entryIds,
    fromCategoryKey: input.fromCategoryKey,
    toCategoryKey: input.toCategoryKey,
    actions,
    ...(actions.length === 1 ? { step: actions[0].type } : {}),
  }
}

export function buildConsolidationPlan(input: {
  policy: ConsolidationPolicy
  virtual: VirtualComposition
  sourceByEntry: Map<string, string>
  athleteContexts: Map<string, ConsolidationAthleteContext>
  formatRules: BracketFormatRuleLike[]
  drawParticipantCounts?: Map<string, number>
}): ConsolidationPlan {
  const policy = normalizePolicy(input.policy)
  const virtual = cloneVirtual(input.virtual)
  const initialCategoryByEntry = new Map<string, string>()
  for (const [categoryKey, entryIds] of virtual) {
    for (const entryId of entryIds) {
      initialCategoryByEntry.set(entryId, categoryKey)
    }
  }
  const trace: ConsolidationPlan['trace'] = []
  let hopIndex = 0

  const enabledSteps = policy.steps
    .map((step, stepIndex) => ({ step, stepIndex }))
    .filter(({ step }) => step.enabled)

  for (const { step, stepIndex } of enabledSteps) {
    const incompleteSources = [...virtual.keys()].filter((categoryKey) => {
      const virtualCount = virtual.get(categoryKey)?.length ?? 0
      if (!isIncomplete(virtualCount, policy.incompleteThreshold)) {
        return false
      }
      const drawCount = input.drawParticipantCounts?.get(categoryKey)
      if (drawCount === 0) {
        return false
      }
      return true
    })

    const orderedSources = sortSourcesForStep(incompleteSources, step)
    const targetKeysUsedThisWave = new Set<string>()

    for (const sourceKey of orderedSources) {
      if (targetKeysUsedThisWave.has(sourceKey)) {
        continue
      }

      const sourceEntryIds = [...(virtual.get(sourceKey) ?? [])]
      const sourceCount = sourceEntryIds.length
      if (!isIncomplete(sourceCount, policy.incompleteThreshold)) {
        continue
      }

      const rawCandidates = buildCandidateKeysForStep(sourceKey, step).filter((candidate) =>
        stepAllowsTarget(sourceKey, candidate, step.actions),
      )
      const rankedCandidates = rankTargetCandidates({
        candidates: rawCandidates,
        virtual,
        sourceCount,
        incompleteThreshold: policy.incompleteThreshold,
        formatRules: input.formatRules,
      })

      if (rankedCandidates.length === 0) {
        continue
      }

      for (const targetKey of rankedCandidates) {
        const skipReason = evaluateMove({
          sourceKey,
          targetKey,
          sourceEntryIds,
          sourceCount,
          step,
          virtual,
          policy,
          athleteContexts: input.athleteContexts,
          formatRules: input.formatRules,
        })
        if (skipReason) {
          continue
        }

        virtual.delete(sourceKey)
        const targetEntries = [...(virtual.get(targetKey) ?? []), ...sourceEntryIds]
        virtual.set(targetKey, targetEntries)
        targetKeysUsedThisWave.add(targetKey)

        trace.push(
          buildTraceHop({
            hopIndex,
            stepIndex,
            entryIds: [...sourceEntryIds],
            fromCategoryKey: sourceKey,
            toCategoryKey: targetKey,
            step,
          }),
        )
        hopIndex += 1
        break
      }
    }
  }

  const skipped: ConsolidationPlan['skipped'] = []
  for (const [categoryKey, entryIds] of virtual) {
    const virtualCount = entryIds.length
    if (!isIncomplete(virtualCount, policy.incompleteThreshold)) {
      continue
    }
    const drawCount = input.drawParticipantCounts?.get(categoryKey)
    if (drawCount === 0) {
      continue
    }
    skipped.push({
      categoryKey,
      reason: 'NO_CANDIDATE',
      entryIds: [...entryIds],
    })
  }

  const finalPlacements: ConsolidationPlan['finalPlacements'] = []
  for (const [finalCategoryKey, entryIds] of virtual) {
    for (const entryId of entryIds) {
      const fromCategoryKey = initialCategoryByEntry.get(entryId)
      if (!fromCategoryKey || fromCategoryKey === finalCategoryKey) continue
      finalPlacements.push({
        entryId,
        fromCategoryKey,
        finalCategoryKey,
      })
    }
  }

  const plan: ConsolidationPlan = {
    finalPlacements,
    trace,
    skipped,
    affectedCategoryKeys: [],
  }
  plan.affectedCategoryKeys = collectAffectedKeys(plan)
  return plan
}

function evaluateMove(input: {
  sourceKey: string
  targetKey: string
  sourceEntryIds: string[]
  sourceCount: number
  step: ConsolidationStep
  virtual: VirtualComposition
  policy: ConsolidationPolicy
  athleteContexts: Map<string, ConsolidationAthleteContext>
  formatRules: BracketFormatRuleLike[]
}): ConsolidationSkipReason | null {
  if (input.sourceCount <= 0) return 'SOURCE_NO_LONGER_INCOMPLETE'
  if (input.sourceCount > input.policy.incompleteThreshold) return 'SOURCE_NO_LONGER_INCOMPLETE'
  if (!input.virtual.has(input.targetKey)) return 'TARGET_NOT_FOUND'

  const targetCount = input.virtual.get(input.targetKey)?.length ?? 0
  if (targetCount <= 0) return 'TARGET_EMPTY'

  if (
    exceedsFormatMax({
      sourceCount: input.sourceCount,
      targetCount,
      formatRules: input.formatRules,
    })
  ) {
    return 'FORMAT_MAX_EXCEEDED'
  }

  const athletes = input.sourceEntryIds
    .map((entryId) => input.athleteContexts.get(entryId))
    .filter((item): item is ConsolidationAthleteContext => item != null)

  if (athletes.length !== input.sourceEntryIds.length) {
    return 'GROUP_INELIGIBLE'
  }

  const eligibilityError = assertGroupEligibleForTarget({
    athletes,
    targetCategoryKey: input.targetKey,
    actions: input.step.actions,
  })
  if (eligibilityError) return 'GROUP_INELIGIBLE'

  return null
}

export function buildVirtualComposition(
  entries: Array<{ entryId: string; effectiveCategoryKey: string }>,
): VirtualComposition {
  const virtual: VirtualComposition = new Map()
  for (const entry of entries) {
    const list = virtual.get(entry.effectiveCategoryKey) ?? []
    list.push(entry.entryId)
    virtual.set(entry.effectiveCategoryKey, list)
  }
  for (const [key, ids] of virtual) {
    virtual.set(key, [...ids].sort())
  }
  return virtual
}
