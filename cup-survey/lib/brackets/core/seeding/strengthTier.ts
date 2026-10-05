import { normalizeSportRankId, sportRankGroups } from '../../../config/ranks'

const tierByRankId = new Map<string, number>()
let tierCounter = 0
for (const group of sportRankGroups) {
  for (const option of group.options) {
    if (option.id === 'none') continue
    tierByRankId.set(option.id, ++tierCounter)
  }
}

/** Higher value = stronger athlete (MSMK > MS > KMS > adult > youth > child). */
export function getStrengthTier(rankId: string | null | undefined): number | null {
  const normalized = normalizeSportRankId(rankId)
  if (!normalized || normalized === 'none') return null
  return tierByRankId.get(normalized) ?? null
}

export function getStrengthTierLabel(tier: number): string {
  for (const [rankId, value] of tierByRankId.entries()) {
    if (value === tier) return rankId
  }
  return `tier:${tier}`
}

export function compareStrengthTiersDesc(a: number, b: number): number {
  return b - a
}
