import { adminBoutsDraftStatus } from '@/lib/ui/adminSurfaceStyles'

interface AdminBoutsDraftStatusProps {
  saving?: boolean
  isDirty?: boolean
}

export function AdminBoutsDraftStatus({ saving = false, isDirty = false }: AdminBoutsDraftStatusProps) {
  if (saving) {
    return (
      <span className={adminBoutsDraftStatus} aria-live="polite">
        Сохранение…
      </span>
    )
  }

  if (isDirty) {
    return (
      <span className={`${adminBoutsDraftStatus} text-amber-700 dark:text-amber-400`} aria-live="polite">
        Изменено
      </span>
    )
  }

  return null
}
