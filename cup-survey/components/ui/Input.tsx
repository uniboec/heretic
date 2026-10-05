import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import {
  fieldControlClassName,
  type FieldControlDensity,
  type FieldControlSize,
} from '@/lib/ui/fieldControlStyles'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  required?: boolean
  error?: string
  size?: FieldControlSize
  density?: FieldControlDensity
  controlOnly?: boolean
}

export function Input({
  className,
  label,
  hint,
  required,
  error,
  id,
  size = 'md',
  density = 'comfortable',
  controlOnly = false,
  ...props
}: InputProps) {
  const inputId = id ?? label?.replace(/\s/g, '-').toLowerCase()
  const control = (
    <input
      id={inputId}
      data-field-control
      className={fieldControlClassName({ size, density, error: Boolean(error), className })}
      {...props}
    />
  )

  if (controlOnly) {
    return control
  }

  return (
    <div className="space-y-1.5" data-error-field={error ? 'true' : undefined}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
          {required ? <span className="text-accent"> *</span> : null}
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
