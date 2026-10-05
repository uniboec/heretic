import { resolveFormatRule } from '../core/formatRules'
import type { BracketFormatRuleLike } from '../core/types'

export function rankTargetCandidates(input: {
  candidates: string[]
  virtual: Map<string, string[]>
  sourceCount: number
  incompleteThreshold: number
  formatRules: BracketFormatRuleLike[]
}): string[] {
  const scored = input.candidates.map((key) => {
      const targetCount = input.virtual.get(key)?.length ?? 0
      const mergedCount = targetCount + input.sourceCount
      const stopsBeingIncomplete = mergedCount > input.incompleteThreshold ? 1 : 0
      const rule = resolveFormatRule(mergedCount, input.formatRules)
      const formatHeadroom =
        rule != null ? rule.maxParticipants - mergedCount : Number.MAX_SAFE_INTEGER
      return {
        key,
        stopsBeingIncomplete,
        formatHeadroom,
        targetCount,
      }
    })
    .sort((a, b) => {
      if (a.stopsBeingIncomplete !== b.stopsBeingIncomplete) {
        return b.stopsBeingIncomplete - a.stopsBeingIncomplete
      }
      if (a.formatHeadroom !== b.formatHeadroom) {
        return b.formatHeadroom - a.formatHeadroom
      }
      if (a.targetCount !== b.targetCount) {
        return a.targetCount - b.targetCount
      }
      return a.key.localeCompare(b.key)
    })

  return scored.map((item) => item.key)
}

export function exceedsFormatMax(input: {
  sourceCount: number
  targetCount: number
  formatRules: BracketFormatRuleLike[]
}): boolean {
  const mergedCount = input.sourceCount + input.targetCount
  const rule = resolveFormatRule(mergedCount, input.formatRules)
  if (!rule) return mergedCount > 32
  return mergedCount > rule.maxParticipants
}
