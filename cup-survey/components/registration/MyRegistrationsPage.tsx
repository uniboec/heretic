'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { routes } from '@/lib/routes'
import { formatMoney } from '@/lib/formatMoney'
import { getDeviceToken, registrationDeviceHeaders } from '@/lib/registration/deviceClient'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { RegistrationUnlockForm } from './RegistrationUnlockForm'
import { useRegistrationStageAccess } from './useRegistrationStageAccess'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { eventPage } from '@/lib/ui/eventSurfaceStyles'

interface RegistrationItem {
  id: string
  publicNumber: number
  editToken: string
  clubName: string
  city: string
  status: string
  statusLabel: string
  totalAmount: number
  unpaidAmount: number
  hasPaidEntries: boolean
  hasReviewEntries: boolean
  athletesCount: number
  updatedAt: string
}

const copy = tournamentPageCopy.myRegistrations

export function MyRegistrationsPage() {
  const { loaded: accessLoaded, stageOpen } = useRegistrationStageAccess()
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showLoadForm, setShowLoadForm] = useState(false)
  const [loadMessage, setLoadMessage] = useState('')
  const canManageRegistration = accessLoaded && stageOpen

  const load = () => {
    setLoading(true)
    fetch(withBasePath('/api/registrations/mine'), { headers: registrationDeviceHeaders() })
      .then((response) => readJsonResponse<{ registrations?: RegistrationItem[] }>(response))
      .then((result) => setRegistrations(result.ok ? (result.data.registrations ?? []) : []))
      .catch(() => setRegistrations([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    getDeviceToken()
    load()
  }, [])

  useEffect(() => {
    if (!loading && registrations.length === 0) {
      setShowLoadForm(true)
    }
  }, [loading, registrations.length])

  const handleLoadSuccess = () => {
    setLoadMessage('Заявка добавлена в список.')
    setShowLoadForm(false)
    load()
  }

  return (
    <div className={eventPage}>
      <header className="mb-5 sm:mb-8">
        <Link
          href={withBasePath('/')}
          className="mb-3 inline-flex text-sm font-medium text-muted transition-colors hover:text-accent"
        >
          ← К соревнованию
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl sm:leading-[1.15]">
          {copy.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{copy.description}</p>
      </header>

      <Card className="p-4 sm:p-8">
        <h2 className="text-[1.0625rem] font-bold text-foreground">{copy.listTitle}</h2>
        {loading ? (
          <p className="mt-4 text-sm leading-relaxed text-muted">Загрузка…</p>
        ) : registrations.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3 sm:mt-6 sm:gap-0">
            {registrations.map((reg) => (
              <li
                key={reg.id}
                className="flex flex-col gap-3.5 rounded-[0.875rem] border border-border bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-none sm:border-0 sm:border-b sm:border-border sm:bg-transparent sm:p-0 sm:py-4 sm:first:pt-0 sm:last:border-b-0 sm:last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-bold leading-snug text-foreground">
                    <span className="shrink-0 text-sm font-extrabold text-accent">№ {reg.publicNumber}</span>
                    <span className="min-w-0 break-words text-[0.9375rem]">{reg.clubName}</span>
                  </p>
                  <p className="mt-1 text-[0.8125rem] leading-snug text-muted">
                    {reg.city} · {reg.athletesCount} спортсменов · {formatMoney(reg.totalAmount, { plus: false })}
                  </p>
                  <p className="mt-1 text-[0.8125rem] leading-snug text-muted">{reg.statusLabel}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  {canManageRegistration && reg.unpaidAmount > 0 ? (
                    <Link
                      href={withBasePath(routes.registration(reg.id))}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-accent/20 transition-all hover:bg-accent-hover sm:w-auto sm:min-w-[7.5rem]"
                    >
                      {reg.hasPaidEntries ? 'Доплатить' : 'Оплатить'}
                    </Link>
                  ) : null}
                  {reg.hasReviewEntries ? (
                    <StatusBadge appearance="event" tone="warning" className="self-start sm:self-auto">
                      На проверке
                    </StatusBadge>
                  ) : reg.status === 'PAID' ? (
                    <StatusBadge appearance="event" tone="success" className="self-start sm:self-auto">
                      Подтверждено
                    </StatusBadge>
                  ) : null}
                  {canManageRegistration ? (
                    <Link
                      href={withBasePath(routes.edit(reg.editToken))}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-card px-5 py-2.5 text-center text-sm font-semibold text-accent transition-all hover:border-accent/25 hover:bg-background-soft sm:w-auto sm:min-w-[7.5rem]"
                    >
                      Изменить
                    </Link>
                  ) : accessLoaded && reg.unpaidAmount > 0 ? (
                    <p className="m-0 max-w-64 text-[0.8125rem] leading-snug text-muted">
                      {copy.closedActionsNote}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 flex flex-col gap-2 text-sm leading-relaxed text-muted">
            <p>{copy.empty}</p>
            <p>{copy.emptyHint}</p>
          </div>
        )}
        {loadMessage && (
          <p className="mt-4 text-sm font-semibold text-accent">{loadMessage}</p>
        )}
      </Card>

      <Card className="mt-5 p-4 sm:p-8">
        <h2 className="text-[1.0625rem] font-bold text-foreground">{copy.loadSectionTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{copy.loadSectionHint}</p>

        {!showLoadForm ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-5 min-h-11 w-full sm:w-auto"
            onClick={() => {
              setLoadMessage('')
              setShowLoadForm(true)
            }}
          >
            {copy.loadButton}
          </Button>
        ) : (
          <div className="mt-5">
            <Button
              type="button"
              variant="ghost"
              className="mb-4 h-auto min-h-0 p-0 text-sm font-semibold text-accent hover:underline"
              onClick={() => setShowLoadForm(false)}
            >
              {copy.hideLoadForm}
            </Button>
            <RegistrationUnlockForm
              embedded
              onSuccess={handleLoadSuccess}
              redirectOnSuccess={false}
              title={copy.loadFormTitle}
              description={copy.loadFormDescription}
              submitLabel={copy.loadSubmit}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
