import { cn } from '@/lib/cn'

export type FieldControlSize = 'sm' | 'md' | 'lg'
export type FieldControlDensity = 'compact' | 'comfortable'

const baseClasses =
  'block w-full rounded-lg border bg-white text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted/55 disabled:cursor-not-allowed disabled:opacity-65 disabled:bg-background-soft'

const interactionClasses =
  'border-border hover:not(:disabled):border-accent/22 focus:border-accent focus:shadow-[0_0_0_3px_rgb(from_var(--color-accent)_r_g_b/0.12)]'

const sizeClasses: Record<FieldControlSize, Record<FieldControlDensity, string>> = {
  sm: {
    compact: 'min-h-9 px-3 py-2 text-sm leading-tight',
    comfortable: 'min-h-9 px-3 py-2 text-base leading-tight',
  },
  md: {
    compact: 'px-3.5 py-2.5 text-sm leading-tight',
    comfortable: 'min-h-11 px-3.5 py-2.5 text-base leading-tight',
  },
  lg: {
    compact: 'min-h-12 px-4 py-3 text-sm leading-tight',
    comfortable: 'min-h-[3.25rem] px-4 py-3 text-base leading-tight',
  },
}

export function fieldControlClassName({
  size = 'md',
  density = 'comfortable',
  error,
  className,
}: {
  size?: FieldControlSize
  density?: FieldControlDensity
  error?: boolean
  className?: string
} = {}) {
  return cn(
    baseClasses,
    interactionClasses,
    sizeClasses[size][density],
    error && 'border-accent shadow-[0_0_0_3px_rgb(from_var(--color-accent)_r_g_b/0.12)]',
    className,
  )
}

export const selectControlClasses = cn(
  'appearance-none bg-[length:1.125rem] bg-[position:right_0.75rem_center] bg-no-repeat pr-10',
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%235c6673'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z' clip-rule='evenodd'/%3E%3C/svg%3E\")]",
)
