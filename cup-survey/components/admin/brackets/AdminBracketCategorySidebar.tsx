'use client'

import {
  adminPanel,
  adminPanelHeader,
  adminRowCardButton,
  adminRowCardSelected,
} from '@/lib/ui/adminSurfaceStyles'
import { boutsRepairRequiredMessage } from '@/lib/bouts/repairRequired'
import {
  formatCategoryStatusLabel,
  formatParticipantCount,
} from './bracketAdminUtils'
import type { CategoryPanelData } from './AdminBracketCategoryPanel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'

interface AdminBracketCategorySidebarProps {
  categories: CategoryPanelData[]
  filteredCategories: CategoryPanelData[]
  selectedKey: string | null
  categoryQuery: string
  matCount: number
  onCategoryQueryChange: (value: string) => void
  onSelectCategory: (categoryKey: string) => void
}

export function AdminBracketCategorySidebar({
  filteredCategories,
  selectedKey,
  categoryQuery,
  matCount,
  onCategoryQueryChange,
  onSelectCategory,
}: AdminBracketCategorySidebarProps) {
  return (
    <aside className={`${adminPanel} print:hidden`}>
      <div className={adminPanelHeader}>Категории</div>
      <div className="space-y-3 p-3">
        <Input
          controlOnly
          density="compact"
          className="w-full"
          placeholder="Категория, ФИО или клуб"
          value={categoryQuery}
          onChange={(event) => onCategoryQueryChange(event.target.value)}
        />
        <ul className="max-h-[65vh] space-y-2 overflow-y-auto">
          {filteredCategories.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-muted">Категории не найдены</li>
          ) : (
            filteredCategories.map((category) => (
              <li key={category.categoryKey}>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    adminRowCardButton,
                    'gap-1.5 p-3',
                    selectedKey === category.categoryKey && adminRowCardSelected,
                  )}
                  onClick={() => onSelectCategory(category.categoryKey)}
                >
                  <span className="w-full min-w-0 font-medium leading-snug break-words text-foreground">
                    {category.title}
                  </span>
                  <span className="w-full text-xs text-muted">
                    {formatCategoryStatusLabel(category.status)} ·{' '}
                    {formatParticipantCount(category.participants.length)}
                  </span>
                  {(category.competitionStage > 1 ||
                    category.publicVisible ||
                    category.boutsReleased ||
                    category.boutsRepairRequired ||
                    category.compositionStale ||
                    category.seedingStale ||
                    category.balanceStale) && (
                    <span className="flex w-full flex-wrap gap-1 pt-0.5">
                      {category.competitionStage > 1 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                          Этап {category.competitionStage}
                        </span>
                      )}
                      {category.publicVisible && (
                        <span className="rounded-full bg-sky-soft px-2 py-0.5 text-[11px] font-medium text-sky-foreground">
                          На сайте
                        </span>
                      )}
                      {category.boutsReleased && (
                        <span className="rounded-full bg-sky-soft px-2 py-0.5 text-[11px] font-medium text-sky-foreground">
                          В расписании
                        </span>
                      )}
                      {category.boutsRepairRequired && (
                        <span
                          className="cursor-help rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-foreground"
                          title={boutsRepairRequiredMessage(category.matIndex, matCount)}
                        >
                          Ковёр
                        </span>
                      )}
                      {category.compositionStale && (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                          Состав
                        </span>
                      )}
                      {category.seedingStale && (
                        <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[11px] font-medium text-violet-foreground">
                          Жеребьёвка
                        </span>
                      )}
                      {category.balanceStale && (
                        <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[11px] font-medium text-violet-foreground">
                          Баланс
                        </span>
                      )}
                    </span>
                  )}
                </Button>
              </li>
            ))
          )}
        </ul>
      </div>
    </aside>
  )
}
