import type { InputHTMLAttributes } from 'react'
import { AdminField } from '@/components/admin/AdminField'
import { Input } from '@/components/ui/Input'
import type { FieldControlSize } from '@/lib/ui/fieldControlStyles'
import { adminInputUnitSuffix, adminInputWithUnitWrap } from '@/lib/ui/adminSurfaceStyles'

interface AdminInputWithUnitProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  unit: string
  fieldClassName?: string
  size?: FieldControlSize
}

export function AdminInputWithUnit({
  label,
  hint,
  error,
  unit,
  id,
  fieldClassName,
  size = 'md',
  className,
  ...props
}: AdminInputWithUnitProps) {
  const inputId = id ?? label?.replace(/\s/g, '-').toLowerCase()

  return (
    <AdminField label={label} hint={hint} error={error} id={inputId} className={fieldClassName}>
      <div className={adminInputWithUnitWrap}>
        <Input
          id={inputId}
          controlOnly
          density="compact"
          size={size}
          className={className}
          {...props}
        />
        <span className={adminInputUnitSuffix} aria-hidden="true">{unit}</span>
      </div>
    </AdminField>
  )
}
