import { formatTournamentDateTime } from '../datetime/tournament'
import { formatAgeDivisionFilterLabel, getAgeDivision } from '../config/fseCategories'
import { getExperienceLevelLabel, type ExperienceLevelId } from '../config/experienceLevel'
import { getDisciplineShortLabel } from '../config/tournament'
import { isDiscountRuleScheduledActive, type CategoryDiscountRuleRecord } from './categoryDiscountTypes'

export function formatCategoryDiscountScope(rule: {
  discipline: string | null
  experienceLevel: string | null
  ageDivisionId: string | null
}): string {
  const parts: string[] = []

  if (rule.discipline) {
    parts.push(getDisciplineShortLabel(rule.discipline))
  }
  if (rule.experienceLevel) {
    parts.push(getExperienceLevelLabel(rule.experienceLevel as ExperienceLevelId))
  }
  if (rule.ageDivisionId) {
    const division = getAgeDivision(rule.ageDivisionId)
    parts.push(
      division ? formatAgeDivisionFilterLabel(division, true) : rule.ageDivisionId,
    )
  }

  return parts.length > 0 ? parts.join(' · ') : 'Все категории'
}

export function formatCategoryDiscountTitle(rule: CategoryDiscountRuleRecord): string {
  if (rule.label?.trim()) return rule.label.trim()
  const scope = formatCategoryDiscountScope(rule)
  return `Скидка ${rule.discountPercent}% · ${scope}`
}

export function formatCategoryDiscountSchedule(rule: CategoryDiscountRuleRecord): string | null {
  if (!rule.startsAt && !rule.endsAt) return null

  if (rule.startsAt && rule.endsAt) {
    return `с ${formatTournamentDateTime(rule.startsAt)} по ${formatTournamentDateTime(rule.endsAt)}`
  }
  if (rule.startsAt) {
    return `с ${formatTournamentDateTime(rule.startsAt)}`
  }
  return `до ${formatTournamentDateTime(rule.endsAt)}`
}

export function formatCategoryDiscountStatus(rule: CategoryDiscountRuleRecord, now = new Date()): string {
  if (!rule.enabled) return 'Выключено'

  const active = isDiscountRuleScheduledActive(rule, now)
  if (!active) {
    if (rule.startsAt && new Date(rule.startsAt) > now) return 'Запланировано'
    if (rule.endsAt && new Date(rule.endsAt) < now) return 'Завершено'
    return 'Неактивно'
  }

  return 'Активно'
}

