'use client'

import { isBronzeModeConfigurableForCategory } from '@/lib/brackets/core/formatRules'
import { formatBronzeModeLabel, formatSystemLabel } from './bracketAdminUtils'
import { Select } from '@/components/ui/Select'
import type { CategoryPanelData } from './AdminBracketCategoryPanel'

interface AdminBracketFormatControlsProps {
  category: CategoryPanelData
  busy: boolean
  disabled?: boolean
  onSaveOverrides: (
    systemOverride: string | null,
    bronzeModeOverride: 'ONE' | 'TWO' | null,
  ) => void
}

export function AdminBracketFormatControls({
  category,
  busy,
  disabled = false,
  onSaveOverrides,
}: AdminBracketFormatControlsProps) {
  const controlsDisabled = busy || disabled
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Система проведения
        </span>
        <Select
          controlOnly
          density="compact"
          className="w-full"
          disabled={controlsDisabled}
          value={category.systemOverride ?? ''}
          onChange={(event) => {
            const value = event.target.value
            void onSaveOverrides(value || null, category.bronzeModeOverride)
          }}
        >
          <option value="">Авто ({formatSystemLabel(category.autoSystemId)})</option>
          {category.allowedSystemIds.map((id) => (
            <option key={id} value={id}>
              {formatSystemLabel(id)}
            </option>
          ))}
        </Select>
      </label>
      {isBronzeModeConfigurableForCategory(
        category.systemOverride ?? category.autoSystemId ?? '',
        category.participants.length,
      ) && (
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            3-е место
          </span>
          <Select
            controlOnly
            density="compact"
            className="w-full"
            disabled={controlsDisabled}
            value={category.bronzeModeOverride ?? ''}
            onChange={(event) => {
              const value = event.target.value as 'ONE' | 'TWO' | ''
              void onSaveOverrides(category.systemOverride, value || null)
            }}
          >
            <option value="">Авто ({formatBronzeModeLabel(category.autoBronzeMode)})</option>
            <option value="ONE">{formatBronzeModeLabel('ONE')}</option>
            <option value="TWO">{formatBronzeModeLabel('TWO')}</option>
          </Select>
        </label>
      )}
    </div>
  )
}
