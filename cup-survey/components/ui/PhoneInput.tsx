'use client'

import type { InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/Input'
import { formatPhoneMask } from '@/lib/phone'

interface PhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  label?: string
  hint?: string
  required?: boolean
  error?: string
  controlOnly?: boolean
  value: string
  onChange: (value: string) => void
}

export function PhoneInput({
  value,
  onChange,
  label,
  hint,
  required,
  error,
  controlOnly = false,
  id,
  ...props
}: PhoneInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(formatPhoneMask(e.target.value))
  }

  return (
    <Input
      id={id}
      label={label}
      hint={hint}
      required={required}
      error={error}
      controlOnly={controlOnly}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={value}
      onChange={handleChange}
      {...props}
    />
  )
}
