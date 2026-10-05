'use client'

import { Button } from '@/components/ui/Button'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { cn } from '@/lib/cn'
import {
  getEffectiveAutoMatAssignMode,
  isCategoryBatchMode,
  type AutoMatAssignMode,
} from '@/lib/bouts/autoMatMode'

interface AdminBracketMatControlProps {
  drawId: string
  draftId: string
  draftVersion: number
  matIndex: number | null
  matCount: number
  autoMatAssignMode: AutoMatAssignMode
  autoMatByCategoryEnabled: boolean
  busy: boolean
  onDraftChange: (draft: { id: string; version: number }) => void
  onToast: (message: string, type?: 'error' | 'success') => void
  onUpdated?: () => void
}

function autoModeHelpText(
  effectiveMode: AutoMatAssignMode,
  autoMatByCategoryEnabled: boolean,
): string {
  if (isCategoryBatchMode(effectiveMode)) {
    if (effectiveMode === 'BY_CATEGORY_TIME') {
      return 'Авто: при добавлении в расписание все поединки категории назначаются на один наименее загруженный ковёр (балансировка по времени).'
    }
    return 'Авто: при добавлении в расписание все поединки категории назначаются на один наименее загруженный ковёр (балансировка по числу боёв).'
  }
  if (effectiveMode === 'BY_BOUT_TIME') {
    return 'Авто: при добавлении в расписание каждый поединок назначается на наименее загруженный ковёр отдельно (балансировка по времени).'
  }
  if (!autoMatByCategoryEnabled) {
    return 'Авто: при добавлении в расписание каждый поединок назначается на наименее загруженный ковёр отдельно (балансировка по числу боёв).'
  }
  return 'Авто: при добавлении в расписание каждый поединок назначается на наименее загруженный ковёр отдельно.'
}

export function AdminBracketMatControl({
  drawId,
  draftId,
  draftVersion,
  matIndex,
  matCount,
  autoMatAssignMode,
  autoMatByCategoryEnabled,
  busy,
  onDraftChange,
  onToast,
  onUpdated,
}: AdminBracketMatControlProps) {
  const effectiveMode = getEffectiveAutoMatAssignMode({
    autoMatAssignMode,
    autoMatByCategoryEnabled,
  })

  async function patchMatIndex(nextMatIndex: number | null) {
    const res = await fetch(withBasePath(`/api/admin/brackets/draws/${drawId}/mat-index`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId,
        expectedVersion: draftVersion,
        matIndex: nextMatIndex,
      }),
    })
    const result = await readJsonResponse<{
      error?: string
      draft?: { id: string; version: number }
    }>(res)
    if (!result.ok) {
      onToast(result.error ?? 'Не удалось сохранить ковёр', 'error')
      return
    }
    const json = result.data
    if (json.draft) onDraftChange(json.draft)
    onUpdated?.()
    onToast('Ковёр сохранён', 'success')
  }

  const options: Array<{ value: number | null; label: string }> = [
    { value: null, label: 'Авто' },
    ...Array.from({ length: matCount }, (_, index) => ({
      value: index + 1,
      label: `Ковёр ${index + 1}`,
    })),
  ]

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Ковёр для поединков</p>
      <p className="text-xs text-muted">
        {matIndex != null
          ? 'Фиксированный: все поединки категории будут на выбранном ковре.'
          : autoModeHelpText(effectiveMode, autoMatByCategoryEnabled)}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.label}
            type="button"
            variant={matIndex === option.value ? 'primary' : 'secondary'}
            disabled={busy}
            className={cn(matIndex === option.value && 'pointer-events-none')}
            onClick={() => patchMatIndex(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
