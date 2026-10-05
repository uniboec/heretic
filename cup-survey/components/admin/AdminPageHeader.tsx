import {
  adminPageActions,
  adminPageDescription,
  adminPageHeader,
  adminPageTitle,
} from '@/lib/ui/adminSurfaceStyles'

interface AdminPageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  return (
    <div className={adminPageHeader}>
      <div className="min-w-0">
        <h1 className={adminPageTitle}>{title}</h1>
        {description && <p className={adminPageDescription}>{description}</p>}
      </div>
      {actions && <div className={adminPageActions}>{actions}</div>}
    </div>
  )
}
