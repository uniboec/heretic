import 'server-only'

import { parseRegistrationCategoryKey } from '@/lib/registration/categoryIdentity'
import { getDisciplineShortLabel } from '@/lib/config/tournament'
import { loadScheduleDisplayByBoutId } from '@/lib/bouts/loadScheduleDisplayByBoutId'
import { getAdminBracketsDashboard, getAdminLiveCategoryStructure } from '../service'
import { BracketExportError } from './errors'
import type { BracketExportCategory } from './types'
import { isAdminCategoryExportCandidate } from './exportCandidates'

export { isAdminCategoryExportCandidate }

export async function loadAdminExportCategoryStructure(
  categoryKey: string,
  scheduleDisplayByBoutId?: Map<string, string>,
): Promise<BracketExportCategory | null> {
  const live = await getAdminLiveCategoryStructure(categoryKey)
  if (!live?.structure) return null

  const dashboard = await getAdminBracketsDashboard()
  const meta = dashboard.categories.find((c) => c.categoryKey === categoryKey)
  if (!meta) return null

  const identity = parseRegistrationCategoryKey(categoryKey)
  const scheduleMap = scheduleDisplayByBoutId ?? new Map<string, string>()

  return {
    categoryKey,
    title: meta.title,
    discipline: identity ? getDisciplineShortLabel(identity.discipline) : null,
    matIndex: meta.matIndex,
    competitionStage: meta.competitionStage,
    effectiveSystemId: live.effectiveSystemId,
    effectiveBronzeMode: live.effectiveBronzeMode,
    participantCount: meta.participants.length,
    structure: live.structure,
    participants: live.participants.map((p) => ({
      entryId: p.entryId,
      seedPosition: p.seedPosition,
      displayName: p.displayName,
      clubName: p.clubName,
      city: p.city,
    })),
    boutOutcomes: live.boutOutcomes,
    result: live.result,
    boutsReleased: meta.boutsReleased,
    scheduleDisplayByBoutId: Object.fromEntries(scheduleMap),
  }
}

function sortExportCategories(a: BracketExportCategory, b: BracketExportCategory): number {
  const matA = a.matIndex ?? Number.MAX_SAFE_INTEGER
  const matB = b.matIndex ?? Number.MAX_SAFE_INTEGER
  if (matA !== matB) return matA - matB
  if (a.competitionStage !== b.competitionStage) return a.competitionStage - b.competitionStage
  return a.title.localeCompare(b.title, 'ru')
}

export async function loadBracketExportCategories(
  categoryKey?: string | null,
): Promise<BracketExportCategory[]> {
  const dashboard = await getAdminBracketsDashboard()
  const activeMetas = dashboard.categories.filter((c) => c.status === 'ACTIVE')
  const scheduleDisplayByBoutId = await loadScheduleDisplayByBoutId({ adminPreview: true })

  if (categoryKey) {
    const meta = activeMetas.find((c) => c.categoryKey === categoryKey)
    if (!meta) {
      const any = dashboard.categories.find((c) => c.categoryKey === categoryKey)
      if (!any) {
        throw new BracketExportError('Категория не найдена', 404, categoryKey)
      }
      throw new BracketExportError('Категория недоступна для экспорта', 422, categoryKey)
    }
    const loaded = await loadAdminExportCategoryStructure(categoryKey, scheduleDisplayByBoutId)
    if (!loaded) {
      throw new BracketExportError('Сетка категории не сформирована', 404, categoryKey)
    }
    return [loaded]
  }

  if (activeMetas.length === 0) {
    throw new BracketExportError('Нет активных категорий для экспорта', 404)
  }

  const loaded: BracketExportCategory[] = []
  for (const meta of activeMetas) {
    const category = await loadAdminExportCategoryStructure(
      meta.categoryKey,
      scheduleDisplayByBoutId,
    )
    if (!category) {
      throw new BracketExportError(
        `Сетка категории «${meta.title}» не сформирована`,
        500,
        meta.categoryKey,
      )
    }
    loaded.push(category)
  }

  return loaded.sort(sortExportCategories)
}
