import type { TableHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type TableDensity = 'compact' | 'comfortable'

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  density?: TableDensity
}

const densityClasses: Record<TableDensity, string> = {
  compact: 'text-sm',
  comfortable: 'text-base',
}

const baseTableClasses =
  'w-full border-collapse [&_th]:border-b [&_th]:border-border [&_th]:bg-gradient-to-b [&_th]:from-background-soft [&_th]:to-neutral-soft [&_th]:px-3.5 [&_th]:py-3 [&_th]:text-left [&_th]:text-[0.6875rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted [&_td]:border-b [&_td]:border-border/75 [&_td]:px-3.5 [&_td]:py-3 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-neutral-soft/95'

export function Table({ density = 'compact', className, ...props }: TableProps) {
  return <table className={cn(baseTableClasses, densityClasses[density], className)} {...props} />
}
