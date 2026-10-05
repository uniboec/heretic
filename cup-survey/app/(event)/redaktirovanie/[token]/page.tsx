'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { normalizeSportRankId } from '@/lib/config/ranks'
import { RegistrationForm, type AthleteFormRow, type TeamFormData } from '@/components/registration/RegistrationForm'
import { RegistrationPageHeader } from '@/components/registration/RegistrationPageHeader'
import { RegistrationUnlockForm } from '@/components/registration/RegistrationUnlockForm'
import { registrationEditPageDescription } from '@/lib/content/tournament-page'
import { registrationDeviceHeaders } from '@/lib/registration/deviceClient'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { eventPage, registrationEditPage, registrationEditState } from '@/lib/ui/eventSurfaceStyles'

export default function EditRegistrationPage() {
  const params = useParams<{ token: string }>()
  const [initialData, setInitialData] = useState<TeamFormData | null>(null)
  const [lockedPricePerDiscipline, setLockedPricePerDiscipline] = useState<number | null>(null)
  const [publicNumber, setPublicNumber] = useState<number | null>(null)
  const [registrationClosesAt, setRegistrationClosesAt] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch(withBasePath(`/api/registrations/edit/${params.token}`), {
      headers: registrationDeviceHeaders(),
    })
      .then(async (response) => {
        const result = await readJsonResponse<{
          error?: string
          publicNumber?: number
          pricePerDiscipline?: number
          clubId?: string | null
          clubName?: string
          city?: string
          phone?: string
          email?: string
          athletes: Array<{
            athleteId?: string
            lastName: string
            firstName: string
            middleName?: string | null
            birthDate: string
            gender: string
            rank?: string
            disciplineEntries: Array<{
              entryId?: string
              discipline: string
              ageDivisionId: string
              weightCategoryId: string
              experienceLevel: 'novice' | 'experienced'
              paymentStatus?: 'UNPAID' | 'PAYMENT_REVIEW' | 'PAID'
              paymentStatusLabel?: string
              price?: number
            }>
          }>
        }>(response)

        if (
          response.status === 403 &&
          !result.ok &&
          result.body &&
          typeof result.body === 'object' &&
          'error' in result.body &&
          (result.body as { error?: string }).error === 'EDIT_AUTH_REQUIRED'
        ) {
          const body = result.body as { publicNumber?: number }
          setNeedsAuth(true)
          setPublicNumber(body.publicNumber ?? null)
          setInitialData(null)
          return
        }
        if (!result.ok) {
          setInitialData(null)
          return
        }
        const json = result.data
        setNeedsAuth(false)
        setPublicNumber(json.publicNumber ?? null)
        setLockedPricePerDiscipline(json.pricePerDiscipline ?? null)
        setInitialData({
          clubId: json.clubId ?? null,
          clubName: json.clubName ?? '',
          city: json.city ?? '',
          phone: json.phone ?? '',
          email: json.email ?? '',
          consentPersonalData: true,
          consentPublication: true,
          athletes: json.athletes.map((a): AthleteFormRow => ({
            athleteId: a.athleteId ?? '',
            lastName: a.lastName,
            firstName: a.firstName,
            middleName: a.middleName ?? '',
            birthDate: a.birthDate,
            gender: a.gender === 'male' || a.gender === 'female' ? a.gender : '',
            rank: normalizeSportRankId(a.rank),
            disciplineEntries: a.disciplineEntries.map((entry) => ({
              entryId: entry.entryId ?? '',
              discipline: entry.discipline,
              ageDivisionId: entry.ageDivisionId,
              weightCategoryId: entry.weightCategoryId,
              experienceLevel: entry.experienceLevel,
              paymentStatus: entry.paymentStatus,
              paymentStatusLabel: entry.paymentStatusLabel,
              price: entry.price,
            })),
          })),
        })
      })
      .catch(() => {
        setInitialData(null)
      })
      .finally(() => setLoading(false))
  }, [params.token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetch(withBasePath('/api/tournament/state'))
      .then((response) => readJsonResponse<{ registrationClosesAt?: string }>(response))
      .then((result) => {
        if (result.ok && result.data.registrationClosesAt) {
          setRegistrationClosesAt(result.data.registrationClosesAt)
        }
      })
      .catch(() => undefined)
  }, [])

  if (loading) {
    return <p className={registrationEditState}>Загрузка…</p>
  }

  if (needsAuth) {
    return (
      <div className={`${eventPage} ${registrationEditPage}`}>
        <RegistrationPageHeader
          title="Редактирование регистрации"
          description="Подтвердите секретный код, чтобы изменить данные спортсменов."
        />
        <RegistrationUnlockForm
          editToken={params.token}
          publicNumber={publicNumber ?? undefined}
          onSuccess={load}
        />
      </div>
    )
  }

  if (!initialData) {
    return <p className={registrationEditState}>Регистрация не найдена.</p>
  }

  return (
    <div className={`${eventPage} ${registrationEditPage} pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0`}>
      <RegistrationPageHeader
        title="Изменить регистрацию"
        description={registrationEditPageDescription(registrationClosesAt)}
      />
      <RegistrationForm
        editToken={params.token}
        initialData={initialData}
        lockedPricePerDiscipline={lockedPricePerDiscipline ?? undefined}
      />
    </div>
  )
}
