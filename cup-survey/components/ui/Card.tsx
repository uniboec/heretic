import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type CardDensity = 'compact' | 'comfortable'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  density?: CardDensity
}

const densityClasses: Record<CardDensity, string> = {
  compact: 'p-4',
  comfortable: 'p-6',
}

export function Card({ children, density = 'comfortable', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card shadow-card',
        densityClasses[density],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
