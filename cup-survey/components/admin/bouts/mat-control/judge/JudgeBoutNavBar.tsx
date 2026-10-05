'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MatBoutNavItem } from '@/lib/bouts/buildMatBoutsNav'
import { getDisciplineShortLabel } from '@/lib/config/tournament'
import { formatBoutDisplayStatus } from '@/lib/bouts/presentation/boutDisplayStatus'
import { judgeStyles } from './judgeModeStyles'

export function JudgeBoutNavBar({
  items,
  activeBoutId,
  onSelect,
  disabled,
}: {
  items: MatBoutNavItem[]
  activeBoutId: string | null
  onSelect: (boutId: string) => void
  disabled?: boolean
}) {
  if (items.length <= 1) return null

  const activeIndex = items.findIndex((item) => item.boutId === activeBoutId)
  const current = activeIndex >= 0 ? items[activeIndex]! : items[0]!
  const currentIndex = activeIndex >= 0 ? activeIndex : 0
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < items.length - 1

  const discipline = getDisciplineShortLabel(current.discipline)

  return (
    <div className="border-b border-border bg-surface/80 px-3 py-2 lg:px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={judgeStyles.boutNavBtn}
          disabled={disabled || !hasPrev}
          onClick={() => hasPrev && onSelect(items[currentIndex - 1]!.boutId)}
          aria-label="Предыдущий поединок"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Поединок {currentIndex + 1} из {items.length}
          </p>
          <p className="truncate text-sm font-bold text-foreground">
            №{current.scheduleDisplayNumber}
            {discipline ? ` · ${discipline}` : ''}
            {' · '}
            {current.categoryTitle}
          </p>
          <p className="text-[11px] font-semibold text-muted">
            {formatBoutDisplayStatus(current.displayStatus)}
          </p>
        </div>

        <button
          type="button"
          className={judgeStyles.boutNavBtn}
          disabled={disabled || !hasNext}
          onClick={() => hasNext && onSelect(items[currentIndex + 1]!.boutId)}
          aria-label="Следующий поединок"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
