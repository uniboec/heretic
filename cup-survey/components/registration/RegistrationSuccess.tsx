'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { routes } from '@/lib/routes'
import { formatMoney } from '@/lib/formatMoney'
import { getDisciplineLabel } from '@/lib/config/tournament'
import { hasClubDiscount, originalAmountForEntries } from '@/lib/registration/pricing'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { PaymentModal } from './PaymentModal'
import { PriceWithDiscount } from './PriceWithDiscount'
import { useRegistrationStageAccess } from './useRegistrationStageAccess'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { eventCard, paymentUi } from '@/lib/ui/eventSurfaceStyles'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface AthleteEntryView {
  id: string
  discipline: string
  categoryLabel: string
  price: number
  paymentStatus: 'UNPAID' | 'PAYMENT_REVIEW' | 'PAID'
  paymentStatusLabel: string
}

interface RegistrationView {
  id: string
  publicNumber: number
  statusLabel: string
  totalAmount: number
  unpaidAmount: number
  pricePerDiscipline: number
  basePricePerDiscipline: number
  clubDiscountPercent: number | null
  clubName: string
  athletes: Array<{
    id: string
    fullName: string
    entries: AthleteEntryView[]
    amount: number
    unpaidEntryIds: string[]
  }>
  payment: {
    recipientName: string
    bankName: string
    cardNumber: string
    phoneNumber: string
    inn: string
    account: string
    bik: string
    purpose: string
  }
  adminComment: string | null
}

interface PaymentGroup {
  title: string
  entries: AthleteEntryView[]
}

type PaymentTarget = {
  title: string
  groups: PaymentGroup[]
}

export function RegistrationSuccess({ registrationId }: { registrationId: string }) {
  const { loaded: accessLoaded, stageOpen } = useRegistrationStageAccess()
  const [data, setData] = useState<RegistrationView | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null)
  const canPay = accessLoaded && stageOpen

  const load = () => {
    fetch(withBasePath(`/api/registrations/${registrationId}`))
      .then((response) => readJsonResponse<RegistrationView>(response))
      .then((result) => setData(result.ok ? result.data : null))
      .catch(() => setData(null))
  }

  useEffect(() => {
    load()
  }, [registrationId])

  const teamUnpaidEntries = useMemo(
    () => data?.athletes.flatMap((a) => a.entries.filter((e) => e.paymentStatus === 'UNPAID')) ?? [],
    [data],
  )

  if (!data) return <p className="py-12 text-center text-[var(--color-muted)]">Загрузка…</p>

  const hasDiscount = hasClubDiscount(data.basePricePerDiscipline, data.pricePerDiscipline)
  const unpaidEntryCount = teamUnpaidEntries.length
  const originalUnpaidAmount = hasDiscount
    ? originalAmountForEntries(unpaidEntryCount, data.basePricePerDiscipline)
    : null
  const originalTotalAmount = hasDiscount
    ? data.athletes.reduce(
        (sum, athlete) => sum + originalAmountForEntries(athlete.entries.length, data.basePricePerDiscipline),
        0,
      )
    : null

  return (
    <div className="space-y-6">
      <div className={cn(eventCard, 'border-l-4 border-l-accent p-6 sm:p-8')}>
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-accent)]">Регистрация принята</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[var(--color-foreground)]">№ {data.publicNumber}</h1>
        <p className="mt-2 text-[var(--color-muted)]">{data.statusLabel}</p>
      </div>

      <section className={cn(eventCard, 'p-6')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-bold text-[var(--color-foreground)]">{data.clubName}</h2>
          {hasDiscount && data.clubDiscountPercent && (
            <span className={paymentUi.discountBadge}>Скидка клуба −{data.clubDiscountPercent}%</span>
          )}
        </div>
        <ul className="mt-4 divide-y divide-[var(--color-border)]">
          {data.athletes.map((a) => (
            <li key={a.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{a.fullName}</p>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--color-muted)]">
                    {a.entries.map((entry) => (
                      <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {getDisciplineLabel(entry.discipline, true)} — {entry.categoryLabel}
                        </span>
                        <span className="flex flex-wrap items-center justify-end gap-2 text-xs font-medium text-[var(--color-foreground)]">
                          <span className="text-[var(--color-muted)]">{entry.paymentStatusLabel}</span>
                          <PriceWithDiscount
                            amount={entry.price}
                            originalAmount={hasDiscount ? data.basePricePerDiscipline : null}
                            size="sm"
                            align="right"
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <PriceWithDiscount
                    amount={a.amount}
                    originalAmount={
                      hasDiscount
                        ? originalAmountForEntries(a.entries.length, data.basePricePerDiscipline)
                        : null
                    }
                    size="md"
                    align="right"
                    className="text-sm font-semibold"
                  />
                  {canPay && a.unpaidEntryIds.length > 0 ? (
                    <Button
                      type="button"
                      className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                      onClick={() =>
                        setPaymentTarget({
                          title: `Оплата — ${a.fullName}`,
                          groups: [
                            {
                              title: a.fullName,
                              entries: a.entries.filter((e) => e.paymentStatus === 'UNPAID'),
                            },
                          ],
                        })
                      }
                    >
                      Оплатить
                    </Button>
                  ) : !canPay && accessLoaded && a.unpaidEntryIds.length > 0 ? (
                    <span className="text-xs text-[var(--color-muted)] sm:text-right">
                      {tournamentPageCopy.myRegistrations.closedPaymentNote}
                    </span>
                  ) : a.entries.some((entry) => entry.paymentStatus === 'PAYMENT_REVIEW') ? (
                    <StatusBadge appearance="event" tone="warning" className="self-end">
                      На проверке
                    </StatusBadge>
                  ) : a.entries.every((entry) => entry.paymentStatus === 'PAID') ? (
                    <StatusBadge appearance="event" tone="success" className="self-end">
                      Оплачен
                    </StatusBadge>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-semibold">Всего по заявке</span>
            {data.unpaidAmount > 0 && (
              <p className="text-sm text-[var(--color-muted)]">
                К оплате:{' '}
                <PriceWithDiscount
                  amount={data.unpaidAmount}
                  originalAmount={originalUnpaidAmount}
                  size="sm"
                />
              </p>
            )}
          </div>
          <PriceWithDiscount
            amount={data.totalAmount}
            originalAmount={originalTotalAmount}
            size="lg"
            align="right"
            className="text-xl font-extrabold"
          />
        </div>
        {canPay && teamUnpaidEntries.length > 1 && (
          <Button
            type="button"
            variant="secondary"
            className="mt-4 w-full rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
            onClick={() =>
              setPaymentTarget({
                title: 'Оплата за команду',
                groups: data.athletes
                  .filter((athlete) => athlete.unpaidEntryIds.length > 0)
                  .map((athlete) => ({
                    title: athlete.fullName,
                    entries: athlete.entries.filter((entry) => entry.paymentStatus === 'UNPAID'),
                  })),
              })
            }
          >
            Оплатить всю команду
          </Button>
        )}
        {!canPay && accessLoaded && data.unpaidAmount > 0 && (
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            {tournamentPageCopy.myRegistrations.closedPaymentNote}
          </p>
        )}
      </section>

      <section className={cn(eventCard, 'p-6')}>
        <h2 className="font-bold text-[var(--color-foreground)]">Редактирование</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {canPay
            ? 'Запомните секретный код. Оплатить или изменить заявку — в разделе «Мои заявки».'
            : accessLoaded
              ? tournamentPageCopy.myRegistrations.closedActionsNote
              : 'Запомните секретный код. Оплатить или изменить заявку — в разделе «Мои заявки».'}
        </p>
        <Link
          href={withBasePath(routes.myRegistrations)}
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
        >
          Мои заявки
        </Link>
      </section>

      {data.adminComment && (
        <section className={cn(eventCard, 'p-6')}>
          <p className="text-sm text-[var(--color-accent)]">От организатора: {data.adminComment}</p>
        </section>
      )}

      <Link href={withBasePath('/')} className="inline-block text-sm font-medium text-[var(--color-accent)] hover:underline">
        ← На страницу турнира
      </Link>

      {paymentTarget && (
        <PaymentModal
          open
          onClose={() => setPaymentTarget(null)}
          registrationId={data.id}
          title={paymentTarget.title}
          groups={paymentTarget.groups}
          payment={data.payment}
          basePricePerDiscipline={data.basePricePerDiscipline}
          clubDiscountPercent={data.clubDiscountPercent}
          onSuccess={load}
        />
      )}
    </div>
  )
}
