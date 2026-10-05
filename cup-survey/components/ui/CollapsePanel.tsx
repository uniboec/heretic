import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CollapsePanelProps {
  open: boolean
  children: ReactNode
  className?: string
  innerClassName?: string
}

export function CollapsePanel({ open, children, className, innerClassName }: CollapsePanelProps) {
  return (
    <div className={cn('collapse-panel', open && 'is-open', className)}>
      <div className={cn('collapse-panel-inner', innerClassName)}>{children}</div>
    </div>
  )
}
