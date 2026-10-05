import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import {
  fieldControlClassName,
  type FieldControlDensity,
  type FieldControlSize,
} from '@/lib/ui/fieldControlStyles'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  size?: FieldControlSize
  density?: FieldControlDensity
  controlOnly?: boolean
}

export function Textarea({
  className,
  label,
  hint,
  error,
  id,
  size = 'md',
  density = 'comfortable',
  controlOnly = false,
  ...props
}: TextareaProps) {
  const inputId = id ?? label?.replace(/\s/g, '-').toLowerCase()
  const control = (
    <textarea
      id={inputId}
      data-field-control
      className={fieldControlClassName({
        size,
        density,
        error: Boolean(error),
        className: cn('min-h-24 resize-y', className),
      })}
      {...props}
    />
  )

  if (controlOnly) {
    return control
  }

  return (
    <div className="space-y-1.5" data-error-field={error ? 'true' : undefined}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
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
