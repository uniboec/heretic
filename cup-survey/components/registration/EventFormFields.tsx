'use client'

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Input } from '@/components/ui/Input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Select } from '@/components/ui/Select'

interface EventFieldProps {
  label?: string
  hint?: string
  error?: string
  id?: string
  className?: string
  children: ReactNode
}

export function EventField({ label, hint, error, id, className, children }: EventFieldProps) {
  return (
    <div
      className={cn('flex min-w-0 flex-col gap-1.5', className)}
      data-error-field={error ? 'true' : undefined}
    >
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
      {error && (
        <p className="text-sm font-medium text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

interface EventInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  fieldClassName?: string
}

export function EventInput({ label, hint, error, id, fieldClassName, className, ...props }: EventInputProps) {
  const inputId = id ?? label?.replace(/\s/g, '-').toLowerCase()

  if (label || hint) {
    return (
      <Input
        id={inputId}
        label={label}
        hint={hint}
        error={error}
        className={className}
        {...props}
      />
    )
  }

  return (
    <EventField error={error} id={inputId} className={fieldClassName}>
      <Input id={inputId} controlOnly error={Boolean(error)} className={className} {...props} />
    </EventField>
  )
}

interface EventSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  fieldClassName?: string
  selectClassName?: string
}

export function EventSelect({
  label,
  hint,
  error,
  id,
  fieldClassName,
  selectClassName,
  children,
  ...props
}: EventSelectProps) {
  const selectId = id ?? label?.replace(/\s/g, '-').toLowerCase()

  if (label || hint) {
    return (
      <Select
        id={selectId}
        label={label}
        hint={hint}
        error={error}
        className={selectClassName}
        {...props}
      >
        {children}
      </Select>
    )
  }

  return (
    <EventField label={label} hint={hint} error={error} id={selectId} className={fieldClassName}>
      <Select id={selectId} controlOnly error={Boolean(error)} className={selectClassName} {...props}>
        {children}
      </Select>
    </EventField>
  )
}

interface EventPhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  label?: string
  hint?: string
  error?: string
  value: string
  onChange: (value: string) => void
}

export function EventPhoneInput({ value, onChange, label, hint, error, id, ...props }: EventPhoneInputProps) {
  const inputId = id ?? label?.replace(/\s/g, '-').toLowerCase()

  if (label || hint) {
    return (
      <PhoneInput
        id={inputId}
        label={label}
        hint={hint}
        error={error}
        value={value}
        onChange={onChange}
        {...props}
      />
    )
  }

  return (
    <EventField label={label} hint={hint} error={error} id={inputId}>
      <PhoneInput
        id={inputId}
        controlOnly
        error={Boolean(error)}
        value={value}
        onChange={onChange}
        {...props}
      />
    </EventField>
  )
}
