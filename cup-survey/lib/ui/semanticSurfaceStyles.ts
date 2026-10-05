/** DNA semantic surface classes — use instead of Tailwind default palette (red-*, amber-*, etc.) */

export const semanticAlertClasses = {
  danger: 'rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-foreground',
  warning: 'rounded-lg border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-foreground',
  success: 'rounded-lg border border-success-border bg-success-soft px-4 py-3 text-sm text-success-foreground',
  info: 'rounded-lg border border-info-border bg-info-soft px-4 py-3 text-sm text-info-foreground',
} as const

export const semanticChipClasses = {
  amber: 'bg-warning-soft text-warning-foreground border-warning-border',
  violet: 'bg-violet-soft text-violet-foreground border-violet-border',
  sky: 'bg-sky-soft text-sky-foreground border-sky-border',
  neutral: 'bg-neutral-soft text-neutral-foreground border-neutral-border',
} as const

export const semanticTextClasses = {
  danger: 'text-danger-foreground',
  warning: 'text-warning-foreground',
  success: 'text-success-foreground',
  info: 'text-info-foreground',
} as const

export const semanticButtonGhostClasses = {
  danger: 'text-danger hover:bg-danger-soft',
} as const
