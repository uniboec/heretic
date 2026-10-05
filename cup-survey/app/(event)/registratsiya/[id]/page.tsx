import { RegistrationSuccess } from '@/components/registration/RegistrationSuccess'
import { eventPage } from '@/lib/ui/eventSurfaceStyles'

export default async function RegistratsiyaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className={`${eventPage} mx-auto max-w-2xl`}>
      <RegistrationSuccess registrationId={id} />
    </div>
  )
}
