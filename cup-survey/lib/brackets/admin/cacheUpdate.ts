import type { AdminCategoryMetadata, AdminBracketsDashboardLite } from './types'
import { safeCategoryList } from '@/components/admin/brackets/bracketAdminUtils'
import type { CategoryPanelData } from '@/components/admin/brackets/AdminBracketCategoryPanel'
import { compareBracketCategoryKeys } from '@/lib/registration/categoryRules'

function sortCategoriesByKey<T extends { categoryKey: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => compareBracketCategoryKeys(a.categoryKey, b.categoryKey))
}

function sortCategoryKeyItems<T extends { key: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareBracketCategoryKeys(a.key, b.key))
}

export type DashboardCacheSnapshot = Omit<AdminBracketsDashboardLite, 'categories'> & {
  categories: CategoryPanelData[]
}

export function refreshAllCategoryKeysParticipantCounts(
  previousKeys: AdminBracketsDashboardLite['allCategoryKeys'],
  previousCategories: CategoryPanelData[],
  nextCategories: CategoryPanelData[],
  updates: AdminCategoryMetadata[],
): AdminBracketsDashboardLite['allCategoryKeys'] {
  const map = new Map(previousKeys.map((item) => [item.key, { ...item }]))

  for (const category of nextCategories) {
    map.set(category.categoryKey, {
      key: category.categoryKey,
      title: category.title,
      participantCount: category.participants.length,
    })
  }

  for (const updated of updates) {
    map.set(updated.categoryKey, {
      key: updated.categoryKey,
      title: updated.title,
      participantCount: updated.participants.length,
    })
  }

  for (const previousCategory of previousCategories) {
    const stillVisible = nextCategories.some(
      (category) => category.categoryKey === previousCategory.categoryKey,
    )
    if (stillVisible) continue

    const existing = map.get(previousCategory.categoryKey)
    if (existing) {
      map.set(previousCategory.categoryKey, { ...existing, participantCount: 0 })
    }
  }

  return sortCategoryKeyItems([...map.values()])
}

function mergeCategory(
  categories: CategoryPanelData[],
  updated: AdminCategoryMetadata,
): CategoryPanelData[] {
  const index = categories.findIndex((category) => category.categoryKey === updated.categoryKey)
  if (index === -1) {
    if (updated.participants.length === 0) return categories
    return sortCategoriesByKey([...categories, updated as CategoryPanelData])
  }
  if (updated.participants.length === 0) {
    return categories.filter((category) => category.categoryKey !== updated.categoryKey)
  }
  const next = [...categories]
  next[index] = { ...categories[index], ...updated }
  return next
}

export function applyDraftMutationToDashboard(
  previous: DashboardCacheSnapshot | undefined,
  data: {
    draft?: { id: string; version: number }
    diff?: AdminBracketsDashboardLite['diff']
    category?: AdminCategoryMetadata
    categories?: AdminCategoryMetadata[]
    replaceCategories?: boolean
  },
): DashboardCacheSnapshot | undefined {
  if (!previous) return previous

  if (data.replaceCategories && data.categories) {
    const nextCategories = sortCategoriesByKey(data.categories as CategoryPanelData[])
    return {
      ...previous,
      draft: data.draft ?? previous.draft,
      diff: data.diff ?? previous.diff,
      categories: nextCategories,
      allCategoryKeys: refreshAllCategoryKeysParticipantCounts(
        previous.allCategoryKeys ?? [],
        safeCategoryList(previous.categories),
        nextCategories,
        data.categories,
      ),
    }
  }

  const updates = [
    ...(data.category ? [data.category] : []),
    ...(data.categories ?? []),
  ]
  if (updates.length === 0) return undefined

  const categories = safeCategoryList<CategoryPanelData>(previous.categories)
  let nextCategories = categories
  for (const updated of updates) {
    nextCategories = mergeCategory(nextCategories, updated)
  }

  const sortedCategories = sortCategoriesByKey(nextCategories)

  return {
    ...previous,
    draft: data.draft ?? previous.draft,
    diff: data.diff ?? previous.diff,
    categories: sortedCategories,
    allCategoryKeys: refreshAllCategoryKeysParticipantCounts(
      previous.allCategoryKeys ?? [],
      categories,
      sortedCategories,
      updates,
    ),
  }
}
