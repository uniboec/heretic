import { AdminAthletesDashboard } from '@/components/admin/AdminAthletesDashboard'
import { listAdminAthletes } from '@/lib/registration/adminAthletesList'
import { ensureUnpaidPricesMatchCurrentStage } from '@/lib/registration/stagePricing'

export default async function AdminAthletesPage() {
  await ensureUnpaidPricesMatchCurrentStage()
  const initialRows = await listAdminAthletes()

  return <AdminAthletesDashboard initialRows={initialRows} />
}
