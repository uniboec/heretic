import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { MatControlAuditDashboard } from '@/components/admin/bouts/MatControlAuditDashboard'

export default function MatControlAuditPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Аудит mat-control"
        description="Подозрительные подтверждения, журнал находок и коррекции с полным audit trail."
      />
      <MatControlAuditDashboard />
    </div>
  )
}
