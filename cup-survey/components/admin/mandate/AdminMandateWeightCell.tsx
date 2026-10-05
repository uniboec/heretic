'use client'

import { useEffect, useState } from 'react'
import type { MandateCheckStatus } from '@prisma/client'
import { Input } from '@/components/ui/Input'
import type { WeightStatus } from '@/lib/mandate/types'
import { AdminMandateTriStateControl } from './AdminMandateTriStateControl'
import { cn } from '@/lib/cn'

type AdminMandateWeightCellProps = {
  weightStatus: WeightStatus
  actualWeightKg: number | null
  manualWeightVerified: boolean
  weightCheckMode: string | null
  disabled?: boolean
  compact?: boolean
  onWeightChange: (value: number | null) => void
  onManualVerify: (verified: boolean) => void
  onManualIssue: () => void
  onReset: () => void
}

function deriveWeightCheckStatus(input: {
  weightStatus: WeightStatus
  actualWeightKg: number | null
  manualWeightVerified: boolean
  weightCheckMode: string | null
}): MandateCheckStatus {
  if (input.weightCheckMode === 'MANUAL_ISSUE') return 'ISSUE'
  if (input.weightCheckMode === 'MANUAL' && input.manualWeightVerified) return 'VERIFIED'
  if (input.weightStatus.manualStale) return 'ISSUE'
  if (input.weightCheckMode === 'AUTO' && input.actualWeightKg != null) {
    return input.weightStatus.weightEligible ? 'VERIFIED' : 'ISSUE'
  }
  return 'UNCHECKED'
}

export function AdminMandateWeightCell({
  weightStatus,
  actualWeightKg,
  manualWeightVerified,
  weightCheckMode,
  disabled = false,
  compact = false,
  onWeightChange,
  onManualVerify,
  onManualIssue,
  onReset,
}: AdminMandateWeightCellProps) {
  const [draft, setDraft] = useState(actualWeightKg?.toString() ?? '')

  useEffect(() => {
    setDraft(actualWeightKg?.toString() ?? '')
  }, [actualWeightKg])

  const triState = deriveWeightCheckStatus({
    weightStatus,
    actualWeightKg,
    manualWeightVerified,
    weightCheckMode,
  })

  const handleTriStateChange = (status: MandateCheckStatus) => {
    if (status === 'VERIFIED') {
      onManualVerify(true)
      return
    }
    if (status === 'ISSUE') {
      if (
        weightCheckMode === 'AUTO' &&
        actualWeightKg != null &&
        !weightStatus.weightEligible
      ) {
        return
      }
      onManualIssue()
      return
    }
    onReset()
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="number"
          step="0.01"
          min="0"
          max="250"
          value={draft}
          disabled={disabled}
          placeholder="кг"
          density="compact"
          size="sm"
          className="w-[4.25rem]"
          aria-label="Фактический вес"
          controlOnly
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const trimmed = draft.trim()
            if (!trimmed) {
              onWeightChange(null)
              return
            }
            const parsed = Number(trimmed.replace(',', '.'))
            if (Number.isFinite(parsed)) onWeightChange(parsed)
          }}
        />
        <AdminMandateTriStateControl
          value={triState}
          disabled={disabled}
          onChange={handleTriStateChange}
        />
      </div>
    )
  }

  return (
    <div className="min-w-[11rem] space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          max="250"
          value={draft}
          disabled={disabled}
          placeholder="кг"
          density="compact"
          size="sm"
          className="w-24"
          aria-label="Фактический вес"
          controlOnly
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const trimmed = draft.trim()
            if (!trimmed) {
              onWeightChange(null)
              return
            }
            const parsed = Number(trimmed.replace(',', '.'))
            if (Number.isFinite(parsed)) onWeightChange(parsed)
          }}
        />
        <AdminMandateTriStateControl
          value={triState}
          disabled={disabled}
          onChange={handleTriStateChange}
        />
      </div>

      {weightCheckMode ? (
        <div className="flex flex-wrap gap-1 text-[11px] text-muted">
          {weightStatus.hasWeighIn ? <span>Взвешен</span> : null}
          {weightCheckMode === 'MANUAL' ? <span>· допуск без взвешивания</span> : null}
          {weightCheckMode === 'MANUAL_ISSUE' ? (
            <span className="text-danger-foreground">· проблема по весу (вручную)</span>
          ) : null}
          {weightCheckMode === 'AUTO' && weightStatus.weightEligible ? (
            <span>· допуск по весу</span>
          ) : weightCheckMode === 'AUTO' && weightStatus.hasWeighIn ? (
            <span className="text-danger-foreground">· проблема по весу</span>
          ) : null}
          {weightStatus.manualStale ? (
            <span className="text-warning-foreground">· нужна повторная проверка</span>
          ) : null}
        </div>
      ) : null}

      {weightStatus.categoryResults.length > 0 ? (
        <ul className="space-y-0.5 text-[11px] leading-snug text-muted">
          {weightStatus.categoryResults.map((row) => (
            <li key={row.categoryKey} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{row.categoryLabel}</span>
              <span className="shrink-0 tabular-nums">
                {row.result === 'PASSED'
                  ? '✓'
                  : row.result === 'NOT_APPLICABLE'
                    ? '—'
                    : row.deltaKg != null
                      ? `✕ ${row.deltaKg.toFixed(2)} кг`
                      : '✕'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {weightCheckMode ? (
        <button
          type="button"
          className={cn(
            'text-[11px] font-medium text-muted underline-offset-2 hover:text-foreground hover:underline',
            disabled && 'pointer-events-none opacity-50',
          )}
          disabled={disabled}
          onClick={onReset}
        >
          Сбросить взвешивание
        </button>
      ) : null}
    </div>
  )
}
