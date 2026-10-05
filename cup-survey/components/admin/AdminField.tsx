import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface AdminFieldProps {
  label?: string
  hint?: string
  error?: string
  id?: string
  className?: string
  children: ReactNode
}

export function AdminField({ label, hint, error, id, className, children }: AdminFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-error-field={error ? 'true' : undefined}>
      {label && (
        <label htmlFor={id} className="text-[0.8125rem] font-semibold text-foreground">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs leading-snug text-muted">{hint}</p>}
      {error && (
        <p className="text-sm font-medium text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
