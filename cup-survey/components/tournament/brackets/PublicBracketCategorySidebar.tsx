'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import {
  adminPanel,
  adminPanelHeader,
  adminRowCardButton,
  adminRowCardSelected,
} from '@/lib/ui/adminSurfaceStyles'
import { isPublicBracketCategoryComplete } from '@/lib/brackets/publicCategoryFilters'
import { formatParticipantCount, formatPublicSystemLabel } from '@/lib/brackets/labels'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { Button } from '@/components/ui/Button'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'

export interface PublicBracketCategory {
  categoryKey: string
  discipline: string
  title: string
  systemId: string | null
  participants: Array<{ entryId: string }>
  result?: { status: string } | null
}

interface PublicBracketCategorySidebarProps {
  categories: PublicBracketCategory[]
  selectedKey: string | null
  showCompletionBadge?: boolean
  onSelectCategory: (categoryKey: string) => void
}

const bracketsCopy = tournamentPageCopy.brackets

export function PublicBracketCategorySidebar({
  categories,
  selectedKey,
  showCompletionBadge = false,
  onSelectCategory,
}: PublicBracketCategorySidebarProps) {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!selectedKey || !listRef.current) return
    const selectedItem = listRef.current.querySelector<HTMLElement>(
      `[data-category-key="${selectedKey}"]`,
    )
    selectedItem?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [selectedKey, categories.length])

  return (
    <aside className={cn(tournamentPublicUi.bracketsSidebar, adminPanel, 'print:hidden')}>
      <div className={adminPanelHeader}>Категории</div>
      <div className="p-3">
        <ul
          ref={listRef}
          className={tournamentPublicUi.bracketsCategoryList}
          role="listbox"
          aria-label="Категории"
        >
          {categories.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-muted lg:w-full">
              Категории не найдены
            </li>
          ) : (
            categories.map((category) => {
              const isSelected = selectedKey === category.categoryKey
              const isComplete = isPublicBracketCategoryComplete(category)
              return (
                <li
                  key={category.categoryKey}
                  data-category-key={category.categoryKey}
                  className={tournamentPublicUi.bracketsCategoryItem}
                  role="presentation"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      adminRowCardButton,
                      tournamentPublicUi.bracketsCategoryButton,
                      'flex h-auto w-full flex-col items-start gap-1 p-3 text-left hover:bg-card hover:text-foreground',
                      isSelected && adminRowCardSelected,
                    )}
                    onClick={() => onSelectCategory(category.categoryKey)}
                  >
                    <span className="flex w-full flex-wrap items-center gap-1.5 font-medium leading-snug break-words text-foreground">
                      {category.title}
                      {showCompletionBadge && isComplete ? (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {bracketsCopy.completedBadge}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted">
                      {formatParticipantCount(category.participants.length)}
                    </span>
                    {category.systemId ? (
                      <span className="text-xs text-muted">
                        {formatPublicSystemLabel(category.systemId)}
                      </span>
                    ) : null}
                  </Button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </aside>
  )
}
