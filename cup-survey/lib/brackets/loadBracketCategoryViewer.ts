import { withBasePath } from '@/lib/basePath'
import { fetchAdminCategoryStructure } from '@/lib/brackets/admin/api'
import type { AdminCategoryStructureResponse } from '@/lib/brackets/admin/types'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { readPublicApiResponse } from '@/lib/tournament/readPublicApiResponse'
import type { BracketStructure, CategoryResult } from '@/lib/brackets/core/types'

export type BracketCategoryViewerData = {
  categoryKey: string
  categoryTitle: string | null
  effectiveSystemId: string | null
  structure: BracketStructure | null
  participants: AdminCategoryStructureResponse['participants']
  result: CategoryResult | null
}

type PublicBracketCategory = {
  categoryKey: string
  title: string
  effectiveSystemId?: string | null
  systemId?: string | null
  structure: BracketStructure | null
  result?: CategoryResult | null
  participants: BracketCategoryViewerData['participants']
}

export async function loadAdminBracketCategoryViewer(
  categoryKey: string,
  options?: { live?: boolean },
): Promise<BracketCategoryViewerData> {
  const result = await fetchAdminCategoryStructure(categoryKey, { live: options?.live ?? true })
  if (!result.ok) {
    throw new Error(result.message)
  }
  return {
    categoryKey: result.data.categoryKey,
    categoryTitle: getCategoryTitleFromKey(result.data.categoryKey),
    effectiveSystemId: result.data.effectiveSystemId,
    structure: result.data.structure,
    participants: result.data.participants,
    result: result.data.result ?? null,
  }
}

export async function loadPublicBracketCategoryViewer(
  categoryKey: string,
): Promise<BracketCategoryViewerData> {
  const response = await fetch(withBasePath('/api/tournament/brackets'), { cache: 'no-store' })
  const result = await readPublicApiResponse<{ categories?: PublicBracketCategory[] }>(response)
  if (!result.ok) {
    throw new Error(result.error ?? 'Не удалось загрузить сетки')
  }
  const category = result.data.categories?.find((entry) => entry.categoryKey === categoryKey)
  if (!category) {
    throw new Error('Категория не найдена в опубликованных сетках')
  }
  return {
    categoryKey: category.categoryKey,
    categoryTitle: category.title,
    effectiveSystemId: category.effectiveSystemId ?? category.systemId ?? null,
    structure: category.structure,
    participants: category.participants,
    result: category.result ?? null,
  }
}
