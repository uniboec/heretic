import type { AnnouncerRule } from '@prisma/client'
import {
  getCategoryTitleFromKey,
  parseRegistrationCategoryKey,
} from '@/lib/registration/categoryIdentity'

export type ParsedCategoryParts = {
  age?: string
  weight?: string
}

export function resolveCategoryTitleForSpeech(categoryTitle: string | undefined): string {
  if (!categoryTitle) return ''
  const trimmed = categoryTitle.trim()
  if (!trimmed) return ''

  if (parseRegistrationCategoryKey(trimmed)) {
    return getCategoryTitleFromKey(trimmed)
  }

  return trimmed
}

export function parseCategoryTitle(categoryTitle: string): ParsedCategoryParts {
  const resolved = resolveCategoryTitleForSpeech(categoryTitle)
  const parts = resolved.split(/[·,]/).map((part) => part.trim()).filter(Boolean)
  let age: string | undefined
  let weight: string | undefined

  for (const part of parts) {
    if (/лет|год/i.test(part)) age = part
    if (/кг/i.test(part)) weight = part
  }

  return { age, weight }
}

export function formatCategorySpeech(categoryTitle: string | undefined, rule: AnnouncerRule): string {
  const resolvedTitle = resolveCategoryTitleForSpeech(categoryTitle)
  if (!resolvedTitle) return ''

  if (rule.includeCategory) {
    return `категории ${resolvedTitle}`
  }

  const { age, weight } = parseCategoryTitle(resolvedTitle)
  const parts: string[] = []
  if (rule.includeAge && age) parts.push(age)
  if (rule.includeWeight && weight) parts.push(weight)
  return parts.join(', ')
}
