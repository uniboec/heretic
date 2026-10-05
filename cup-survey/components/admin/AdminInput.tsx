import type { InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/Input'
import type { FieldControlSize } from '@/lib/ui/fieldControlStyles'
import { AdminField } from './AdminField'

export interface AdminInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  fieldClassName?: string
  size?: FieldControlSize
}

export function AdminInput({
  label,
  hint,
  error,
  id,
  fieldClassName,
  size = 'md',
  className,
  ...props
}: AdminInputProps) {
  const inputId = id ?? label?.replace(/\s/g, '-').toLowerCase()

  return (
    <AdminField label={label} hint={hint} error={error} id={inputId} className={fieldClassName}>
      <Input
        id={inputId}
        controlOnly
        density="compact"
        size={size}
        className={className}
        {...props}
      />
    </AdminField>
  )
}
