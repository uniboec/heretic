import { withBasePath } from '@/lib/basePath'
import { routes } from '@/lib/routes'

export function buildMandateCommissionAthleteUrl(athleteId: string): string {
  const params = new URLSearchParams({ athleteId })
  return withBasePath(`${routes.admin.mandateCommission}?${params.toString()}`)
}
