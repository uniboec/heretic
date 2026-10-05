import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { eventStatusBadgeClass } from '@/lib/ui/eventSurfaceStyles'
import { semanticChipClasses } from '@/lib/ui/semanticSurfaceStyles'

export type StatusBadgeTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'info'
  | 'amber'
  | 'violet'
  | 'sky'

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  tone?: StatusBadgeTone
  /** `event` uses compact registration payment-status pills; `chip` for bordered labels. */
  appearance?: 'pill' | 'event' | 'chip'
}

const pillToneClasses: Record<StatusBadgeTone, string> = {
  neutral: 'bg-background-soft text-foreground',
  success: 'bg-success-soft text-success-foreground',
  warning: 'bg-warning-soft text-warning-foreground',
  danger: 'bg-danger-soft text-danger-foreground',
  info: 'bg-info-soft text-info-foreground',
  amber: 'bg-warning-soft text-warning-foreground',
  violet: 'bg-violet-soft text-violet-foreground',
  sky: 'bg-sky-soft text-sky-foreground',
}

export function StatusBadge({
  children,
  tone = 'neutral',
  appearance = 'pill',
  className,
  ...props
}: StatusBadgeProps) {
  const isEvent = appearance === 'event'
  const isChip = appearance === 'chip'
  const chipTone = tone === 'amber' || tone === 'violet' || tone === 'sky' || tone === 'neutral' ? tone : 'neutral'

  return (
    <span
      className={cn(
        isEvent
          ? eventStatusBadgeClass(tone)
          : isChip
            ? [
                'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                semanticChipClasses[chipTone],
              ]
            : [
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5',
                pillToneClasses[tone in pillToneClasses ? tone : 'neutral'],
              ],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
