import { formatParticipantCount, formatSystemLabel } from '../labels'
import type { BracketExportCategory } from '../export/types'
import type { PrintPageChrome } from './types'

export function buildCategoryMetaLine(category: BracketExportCategory): string {
  const systemId = category.effectiveSystemId ?? category.structure.systemId
  return [
    category.discipline,
    formatParticipantCount(category.participantCount),
    systemId ? formatSystemLabel(systemId) : null,
    category.matIndex != null ? `Ковёр ${category.matIndex}` : null,
    `Этап ${category.competitionStage}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function buildPageChrome(input: {
  category: BracketExportCategory
  pageIndex: number
  pageCount: number
  roundRangeLabel?: string
  continuationBanner?: string
}): PrintPageChrome {
  return {
    pageIndex: input.pageIndex,
    pageCount: input.pageCount,
    categoryTitle: input.category.title,
    metaLine: buildCategoryMetaLine(input.category),
    roundRangeLabel: input.roundRangeLabel,
    continuationBanner: input.continuationBanner,
    incomingAnchors: [],
    outgoingAnchors: [],
  }
}

export function pageContinuationBanner(pageIndex: number, pageCount: number): string | undefined {
  if (pageCount <= 1) return undefined
  if (pageIndex === 0) return `Продолжение на листе ${pageIndex + 2}`
  return `Продолжение категории · лист ${pageIndex + 1} из ${pageCount}`
}

export function pageHeaderLabel(pageIndex: number, pageCount: number): string {
  if (pageCount <= 1) return ''
  return `Лист ${pageIndex + 1} из ${pageCount}`
}
