'use client'

import { adminPanel } from '@/lib/ui/adminSurfaceStyles'
import { useMemo } from 'react'
import type { CategoryPanelData } from './AdminBracketCategoryPanel'
import { estimateTournamentMedals } from '@/lib/brackets/core/medalEstimate'

interface AdminBracketMedalEstimateProps {
  categories: CategoryPanelData[]
}

export function AdminBracketMedalEstimate({ categories }: AdminBracketMedalEstimateProps) {
  const estimate = useMemo(
    () =>
      estimateTournamentMedals(
        categories.map((category) => ({
          status: category.status,
          participantCount: category.participants.length,
          systemId: category.effectiveSystemId,
          bronzeMode: category.effectiveBronzeMode,
        })),
      ),
    [categories],
  )

  if (categories.length === 0) {
    return null
  }

  return (
    <section className={`${adminPanel} p-4`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Медали: оценка закупки</h2>
          <p className="mt-1 text-sm text-muted">
            Потенциальное число призовых мест по текущему черновику сеток — для планирования
            наградной атрибутики.
          </p>
        </div>
        <p className="text-sm text-muted lg:text-right">
          Соревновательных: {estimate.activeCategories}
          {estimate.soloCategories > 0 && (
            <span> · одиночных: {estimate.soloCategories}</span>
          )}
          {estimate.excludedCategories > 0 && (
            <span> · не учтено: {estimate.excludedCategories}</span>
          )}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-warning-border bg-warning-soft/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning-foreground/70">
            1-е места
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-warning-foreground">
            {estimate.gold}
          </p>
          <p className="mt-1 text-xs text-warning-foreground/80">золото</p>
        </div>
        <div className="rounded-lg border border-neutral-border bg-neutral-soft px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            2-е места
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-foreground">
            {estimate.silver}
          </p>
          <p className="mt-1 text-xs text-muted">серебро</p>
        </div>
        <div className="rounded-lg border border-bronze-border bg-bronze-soft/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-bronze-foreground/70">
            3-е места
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-bronze-foreground">
            {estimate.bronze}
          </p>
          <p className="mt-1 text-xs text-bronze-foreground/80">бронза</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        В категории с одним участником учитывается только золото. В олимпийской системе при «двух
        бронзах» в категории учитываются 2 медали за 3-е место. Неподдерживаемые категории не
        входят в расчёт.
      </p>
    </section>
  )
}
