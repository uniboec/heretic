'use client'

import { formatLocalTimeInput } from '@/lib/datetime/localTimeInput'
import { AdminInput, type AdminInputProps } from './AdminInput'

const LOCAL_TIME_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9]$'

interface AdminLocalTimeInputProps
  extends Omit<AdminInputProps, 'onChange' | 'type' | 'inputMode'> {
  onChange: (value: string) => void
}

export function AdminLocalTimeInput({
  value,
  onChange,
  maxLength = 5,
  pattern = LOCAL_TIME_PATTERN,
  placeholder = '10:00',
  ...props
}: AdminLocalTimeInputProps) {
  return (
    <AdminInput
      {...props}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      pattern={pattern}
      maxLength={maxLength}
      value={value}
      onChange={(event) => onChange(formatLocalTimeInput(event.target.value))}
    />
  )
}
