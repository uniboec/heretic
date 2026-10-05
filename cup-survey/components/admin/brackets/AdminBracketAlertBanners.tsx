'use client'

import { BRACKET_ACTION_LABELS } from '@/lib/brackets/labels'
import { semanticAlertClasses } from '@/lib/ui/semanticSurfaceStyles'
import type { CategoryPanelData } from './AdminBracketCategoryPanel'

interface AdminBracketAlertBannersProps {
  diff: {
    globalCompositionStale: boolean
    registrationDataStale: boolean
    eligibilityCriteriaStale: boolean
  }
  categories: CategoryPanelData[]
  registeredParticipantCount: number
  categoryCount: number
  warnings: string[]
  autoSyncFailures: Array<{
    categoryKey: string
    errorMessage: string | null
    createdAt: string
  }>
}

export function AdminBracketAlertBanners({
  diff,
  categories,
  registeredParticipantCount,
  categoryCount,
  warnings,
  autoSyncFailures,
}: AdminBracketAlertBannersProps) {
  return (
    <>
      {autoSyncFailures.length > 0 && (
        <div className={semanticAlertClasses.danger}>
          <p className="font-medium">Ошибки авто-синхронизации</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {autoSyncFailures.map((failure) => (
              <li key={`${failure.categoryKey}-${failure.createdAt}`}>
                {failure.categoryKey}
                {failure.errorMessage ? `: ${failure.errorMessage}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {categoryCount === 0 && registeredParticipantCount > 0 && (
        <div className={semanticAlertClasses.warning}>
          <p className="font-medium">Сетки ещё не собраны</p>
          <p className="mt-1">
            В заявках {registeredParticipantCount} допущенных участников, но черновик пуст. Нажмите
            «{BRACKET_ACTION_LABELS.syncAll}», чтобы создать категории.
          </p>
        </div>
      )}

      {diff.registrationDataStale && (
        <div className={semanticAlertClasses.warning}>
          <p className="font-medium">Регистрационные данные изменились.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Синхронизируйте заявки</li>
            <li>Затем выполните жеребьёвку изменённых категорий</li>
          </ol>
        </div>
      )}

      {!diff.globalCompositionStale &&
        categories.some((category) => category.seedingStale || category.balanceStale) && (
        <div className="rounded-lg border border-violet-border bg-violet-soft px-4 py-3 text-sm text-violet-foreground">
          Жеребьёвка или баланс устарели — выполните жеребьёвку для отмеченных категорий.
        </div>
      )}

      {diff.globalCompositionStale && (
        <div className={semanticAlertClasses.warning}>
          Состав устарел — сначала синхронизируйте заявки, затем выполните жеребьёвку изменённых категорий.
        </div>
      )}

      {diff.eligibilityCriteriaStale && (
        <div className="rounded-lg border border-sky-border bg-sky-soft px-4 py-3 text-sm text-sky-foreground">
          Критерии состава изменены. Синхронизируйте заявки.
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-violet-border bg-violet-soft px-4 py-3 text-sm text-violet-foreground">
          <p className="font-medium">Предупреждения:</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
