import { RegistrationForm } from '@/components/registration/RegistrationForm'
import { RegistrationPageHeader } from '@/components/registration/RegistrationPageHeader'
import { eventPage } from '@/lib/ui/eventSurfaceStyles'

export default function RegistratsiyaPage() {
  return (
    <div className={`${eventPage} pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0`}>
      <RegistrationPageHeader
        title="Регистрация на соревнование"
        description="Клуб, спортсмены и категории. Оплата — после отправки заявки."
      />
      <RegistrationForm />
    </div>
  )
}
