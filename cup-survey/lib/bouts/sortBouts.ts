import { compareBoutScheduleCategoryKeys } from '../registration/categoryRules'
import type { InternalBout } from './types'

export function sortBouts(bouts: InternalBout[]): InternalBout[] {
  return [...bouts].sort((a, b) => {
    const matCompare = (a.storedMatIndex ?? Number.MAX_SAFE_INTEGER) - (b.storedMatIndex ?? Number.MAX_SAFE_INTEGER)
    if (matCompare !== 0) return matCompare
    const categoryCompare = compareBoutScheduleCategoryKeys(a.categoryKey, b.categoryKey)
    if (categoryCompare !== 0) return categoryCompare
    return a.matchNumber - b.matchNumber
  })
}
