import { AdminMandateCommissionDashboard } from '@/components/admin/mandate/AdminMandateCommissionDashboard'
import { listMandateCommissionAthletes } from '@/lib/mandate/adminMandateList'

export default async function AdminMandateCommissionPage({
  searchParams,
}: {
  searchParams: Promise<{ athleteId?: string }>
}) {
  const { athleteId } = await searchParams
  const initialData = await listMandateCommissionAthletes(
    athleteId ? { athleteId } : {},
  )

  return (
    <AdminMandateCommissionDashboard
      initialData={initialData}
      initialAthleteId={athleteId ?? ''}
    />
  )
}
