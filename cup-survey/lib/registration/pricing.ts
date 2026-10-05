import { getPricePerDiscipline } from './time'

export interface AthletePricingInput {
  entryCount: number
}

export interface EntryDiscountCriteria {
  discipline: string
  experienceLevel: string
  ageDivisionId: string | null
}

export interface CategoryDiscountRuleLike {
  discountPercent: number
  discipline: string | null
  experienceLevel: string | null
  ageDivisionId: string | null
  enabled?: boolean
}

export function discountRuleMatchesEntry(
  rule: CategoryDiscountRuleLike,
  entry: EntryDiscountCriteria,
): boolean {
  if (rule.enabled === false) return false
  if (rule.discipline && rule.discipline !== entry.discipline) return false
  if (rule.experienceLevel && rule.experienceLevel !== entry.experienceLevel) return false
  if (rule.ageDivisionId && rule.ageDivisionId !== entry.ageDivisionId) return false
  return true
}

/** Среди клубной скидки и подходящих правил выбирается максимальный процент (не суммируется). */
export function getBestDiscountPercent(
  entry: EntryDiscountCriteria,
  rules: CategoryDiscountRuleLike[],
  clubDiscountPercent: number | null | undefined,
): number {
  let bestPercent = 0

  if (clubDiscountPercent && clubDiscountPercent > 0) {
    bestPercent = Math.min(100, Math.max(0, Math.round(clubDiscountPercent)))
  }

  for (const rule of rules) {
    if (!discountRuleMatchesEntry(rule, entry)) continue
    const percent = Math.min(100, Math.max(0, Math.round(rule.discountPercent)))
    if (percent > bestPercent) bestPercent = percent
  }

  return bestPercent
}

export function resolveEntryPrice(
  basePrice: number,
  entry: EntryDiscountCriteria,
  rules: CategoryDiscountRuleLike[],
  clubDiscountPercent: number | null | undefined,
): number {
  const bestPercent = getBestDiscountPercent(entry, rules, clubDiscountPercent)
  return applyClubDiscount(basePrice, bestPercent)
}

export function calculateAthleteAmount(entryCount: number, pricePerDiscipline: number): number {
  return entryCount * pricePerDiscipline
}

export function calculateRegistrationTotal(
  athletes: AthletePricingInput[],
  pricePerDiscipline: number,
): { totalAmount: number; entryCount: number } {
  let totalAmount = 0
  let entryCount = 0
  for (const athlete of athletes) {
    entryCount += athlete.entryCount
    totalAmount += athlete.entryCount * pricePerDiscipline
  }
  return { totalAmount, entryCount }
}

export function getPricingSnapshot(stageId: string) {
  const pricePerDiscipline = getPricePerDiscipline(stageId)
  return { registrationStage: stageId, pricePerDiscipline }
}

export function applyClubDiscount(
  basePrice: number,
  discountPercent: number | null | undefined,
): number {
  if (!discountPercent || discountPercent <= 0) return basePrice
  const percent = Math.min(100, Math.max(0, Math.round(discountPercent)))
  return Math.max(0, Math.round(basePrice * (100 - percent) / 100))
}

export function hasClubDiscount(basePrice: number, discountedPrice: number): boolean {
  return basePrice > discountedPrice
}

export function getClubDiscountPercent(
  basePrice: number,
  discountedPrice: number,
): number | null {
  if (!hasClubDiscount(basePrice, discountedPrice)) return null
  return Math.round((1 - discountedPrice / basePrice) * 100)
}

export function originalAmountForEntries(
  entryCount: number,
  basePricePerDiscipline: number,
): number {
  return entryCount * basePricePerDiscipline
}
