import { formatBracketWarningLabel } from '@/lib/brackets/labels'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'

function resolveCategoryTitle(
  categoryKey: string,
  categoryTitleMap?: Map<string, string> | Record<string, string>,
): string {
  if (categoryTitleMap instanceof Map) {
    return categoryTitleMap.get(categoryKey) ?? getCategoryTitleFromKey(categoryKey)
  }
  if (categoryTitleMap) {
    return categoryTitleMap[categoryKey] ?? getCategoryTitleFromKey(categoryKey)
  }
  return getCategoryTitleFromKey(categoryKey)
}

export function formatBracketWarnings(
  warnings: Array<{ code: string; categoryKey?: string; n?: number }>,
  categoryTitleMap?: Map<string, string> | Record<string, string>,
): string[] {
  return warnings.map((warning) => {
    const base = formatBracketWarningLabel(warning.code)
    if (warning.categoryKey) {
      return `${base} (${resolveCategoryTitle(warning.categoryKey, categoryTitleMap)})`
    }
    return base
  })
}
