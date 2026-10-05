import type { ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import {
  fieldControlClassName,
  selectControlClasses,
  type FieldControlDensity,
  type FieldControlSize,
} from '@/lib/ui/fieldControlStyles'

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  size?: FieldControlSize
  density?: FieldControlDensity
  controlOnly?: boolean
  wrapClassName?: string
  children: ReactNode
}

export function Select({
  className,
  wrapClassName,
  label,
  hint,
  error,
  id,
  size = 'md',
  density = 'comfortable',
  controlOnly = false,
  children,
  ...props
}: SelectProps) {
  const selectId = id ?? label?.replace(/\s/g, '-').toLowerCase()
  const control = (
    <div className={cn('relative w-full', wrapClassName)}>
      <select
        id={selectId}
        data-field-control
        className={fieldControlClassName({
          size,
          density,
          error: Boolean(error),
          className: cn(selectControlClasses, className),
        })}
        {...props}
      >
        {children}
      </select>
    </div>
  )

  if (controlOnly) {
    return control
  }

  return (
    <div className="space-y-1.5" data-error-field={error ? 'true' : undefined}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
      {control}
      {error && (
        <p className="text-sm font-medium text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
