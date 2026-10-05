export interface CategoryDiscountRuleRecord {
  id: string
  label: string | null
  description: string | null
  discountPercent: number
  discipline: string | null
  experienceLevel: string | null
  ageDivisionId: string | null
  enabled: boolean
  showOnSite: boolean
  startsAt: string | null
  endsAt: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function isDiscountRuleScheduledActive(
  rule: {
    enabled: boolean
    startsAt: Date | string | null
    endsAt: Date | string | null
  },
  now = new Date(),
): boolean {
  if (!rule.enabled) return false

  const nowMs = now.getTime()
  const startsMs = rule.startsAt ? new Date(rule.startsAt).getTime() : null
  const endsMs = rule.endsAt ? new Date(rule.endsAt).getTime() : null

  if (startsMs != null && nowMs < startsMs) return false
  if (endsMs != null && nowMs > endsMs) return false
  return true
}
