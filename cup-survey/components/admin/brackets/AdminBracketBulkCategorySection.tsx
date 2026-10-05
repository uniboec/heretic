'use client'

import { getDisciplineShortLabel } from '@/lib/config/tournament'
import { formatParticipantCount, formatSystemLabel } from '@/lib/brackets/labels'
import { parseRegistrationCategoryKey } from '@/lib/registration/categoryIdentity'
import { BracketSystemRenderer } from '@/components/tournament/brackets/BracketSystemRenderer'
import { adminPanel } from '@/lib/ui/adminSurfaceStyles'
import { cn } from '@/lib/cn'
import type { AdminCategoryStructureResponse } from '@/lib/brackets/admin/types'
import type { CategoryPanelData } from './AdminBracketCategoryPanel'

export function buildAdminBracketCategoryMeta(
  category: CategoryPanelData,
  structure?: AdminCategoryStructureResponse,
): string {
  const identity = parseRegistrationCategoryKey(category.categoryKey)
  const disciplineLabel = identity ? getDisciplineShortLabel(identity.discipline) : null
  const systemId = structure?.effectiveSystemId ?? category.effectiveSystemId
  return [
    disciplineLabel,
    formatParticipantCount(category.participants.length),
    systemId ? formatSystemLabel(systemId) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function AdminBracketBulkCategorySection({
  category,
  structure,
  loading,
  error,
  sectionRef,
  scheduleDisplayByBoutId,
}: {
  category: CategoryPanelData
  structure?: AdminCategoryStructureResponse
  loading: boolean
  error: boolean
  sectionRef?: (node: HTMLElement | null) => void
  scheduleDisplayByBoutId?: Map<string, string>
}) {
  const meta = buildAdminBracketCategoryMeta(category, structure)

  return (
    <section
      ref={sectionRef}
      className={cn('admin-brackets-print-all__category admin-brackets-print-target', adminPanel)}
    >
      <div className="admin-brackets-print-header border-b border-border px-3 py-2">
        <h2 className="truncate text-base font-semibold">{category.title}</h2>
        <p className="mt-1 text-xs font-normal text-muted">{meta}</p>
      </div>
      <div className="p-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Загрузка сетки…</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-danger-foreground">Не удалось загрузить сетку</p>
        ) : (
          <BracketSystemRenderer
            variant="admin"
            systemId={structure?.effectiveSystemId ?? category.effectiveSystemId}
            structure={structure?.structure ?? null}
            participants={structure?.participants ?? category.participants}
            result={structure?.result ?? null}
            categoryKey={category.categoryKey}
            boutsReleased={Boolean(category.boutsReleased)}
            scheduleDisplayByBoutId={scheduleDisplayByBoutId}
          />
        )}
      </div>
    </section>
  )
}
