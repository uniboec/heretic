import { cn } from '@/lib/cn'

const disciplineStyles: Record<string, string> = {
  tactic_control: 'bg-info-soft text-info',
  close_control: 'bg-success-soft text-success',
}

interface DisciplineBadgeProps {
  discipline: string
  children: React.ReactNode
  size?: 'sm' | 'md'
  className?: string
}

export function DisciplineBadge({
  discipline,
  children,
  size = 'md',
  className,
}: DisciplineBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-bold tracking-wide',
        size === 'sm' ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-3 py-1.5 text-[0.8125rem]',
        disciplineStyles[discipline],
        className,
      )}
    >
      {children}
    </span>
  )
}
