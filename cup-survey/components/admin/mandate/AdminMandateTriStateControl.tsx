'use client'

import type { MandateCheckStatus } from '@prisma/client'
import { cn } from '@/lib/cn'
import { mandateCheckStatusLabels, mandateCheckStatusTitles } from '@/lib/mandate/labels'
import { adminSegmentTab } from '@/lib/ui/adminSurfaceStyles'

const options: MandateCheckStatus[] = ['UNCHECKED', 'VERIFIED', 'ISSUE']

type AdminMandateTriStateControlProps = {
  value: MandateCheckStatus
  onChange: (value: MandateCheckStatus) => void
  disabled?: boolean
}

function activeOptionClass(option: MandateCheckStatus, active: boolean): string {
  if (!active) return adminSegmentTab(false)
  if (option === 'VERIFIED') {
    return 'inline-flex min-h-8 items-center justify-center rounded-full border border-success-border bg-success-soft px-3.5 py-1 text-[0.8125rem] font-semibold text-success-foreground'
  }
  if (option === 'ISSUE') {
    return 'inline-flex min-h-8 items-center justify-center rounded-full border border-danger-border bg-danger-soft px-3.5 py-1 text-[0.8125rem] font-semibold text-danger-foreground'
  }
  return adminSegmentTab(true)
}

export function AdminMandateTriStateControl({
  value,
  onChange,
  disabled = false,
}: AdminMandateTriStateControlProps) {
  return (
    <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Статус допуска">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          title={mandateCheckStatusTitles[option]}
          className={cn(
            activeOptionClass(option, value === option),
            'min-h-7 min-w-[2rem] px-2 text-[11px] font-bold leading-none transition-colors disabled:opacity-50',
          )}
          onClick={() => onChange(option)}
        >
          {mandateCheckStatusLabels[option]}
        </button>
      ))}
    </div>
  )
}
