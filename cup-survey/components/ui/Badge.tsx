import { cn } from '@/lib/cn'

type BadgeVariant = 'neutral' | 'accent' | 'warning' | 'danger'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-background-soft text-foreground/80 ring-1 ring-border',
  accent: 'bg-accent-soft text-accent ring-1 ring-accent/15',
  warning: 'bg-warning-soft text-warning-foreground ring-1 ring-warning-border/80',
  danger: 'bg-danger-soft text-danger-foreground ring-1 ring-danger-border/80',
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
