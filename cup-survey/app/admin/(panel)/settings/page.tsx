import { AdminNormQualificationSettingsPanel } from '@/components/admin/AdminNormQualificationSettingsPanel'
import { AdminRegistrationScheduleDashboard } from '@/components/admin/AdminRegistrationScheduleDashboard'
import { AdminTeamRankingSettingsPanel } from '@/components/admin/AdminTeamRankingSettingsPanel'

export default function AdminSettingsPage() {
  return (
    <div className="space-y-10">
      <AdminRegistrationScheduleDashboard />
      <AdminTeamRankingSettingsPanel />
      <AdminNormQualificationSettingsPanel />
    </div>
  )
}
