import type { ReactNode, SelectHTMLAttributes } from 'react'
import { Select } from '@/components/ui/Select'
import type { FieldControlSize } from '@/lib/ui/fieldControlStyles'
import { AdminField } from './AdminField'

interface AdminSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  fieldClassName?: string
  selectClassName?: string
  size?: FieldControlSize
  children: ReactNode
}

export function AdminSelect({
  label,
  hint,
  error,
  id,
  fieldClassName,
  selectClassName,
  size = 'md',
  className,
  children,
  ...props
}: AdminSelectProps) {
  const selectId = id ?? label?.replace(/\s/g, '-').toLowerCase()

  return (
    <AdminField label={label} hint={hint} error={error} id={selectId} className={fieldClassName}>
      <Select
        id={selectId}
        controlOnly
        density="compact"
        size={size}
        className={className ?? selectClassName}
        {...props}
      >
        {children}
      </Select>
    </AdminField>
  )
}
