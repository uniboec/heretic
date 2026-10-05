'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { getRegistrationPublicErrorMessage } from '@/lib/registration/publicErrorMessages'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { pluralCategories, pluralDisciplines } from '@/lib/content/tournament-page'
import {
  formatCardNumber,
  formatPaymentPhone,
  getCardNumberCopyValue,
  getPhoneCopyValue,
  PAYMENT_NO_COMMENT_NOTE,
} from '@/lib/registration/payment'
import { formatMoney } from '@/lib/formatMoney'
import { hasClubDiscount, originalAmountForEntries } from '@/lib/registration/pricing'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { PriceWithDiscount } from './PriceWithDiscount'
import { PaymentSberQuickPay } from './PaymentSberQuickPay'

interface PaymentEntry {
  id: string
  categoryLabel: string
  discipline: string
  price: number
}

interface PaymentGroup {
  title: string
  entries: PaymentEntry[]
}

interface PaymentDetails {
  recipientName: string
  bankName: string
  cardNumber: string
  phoneNumber: string
  inn: string
  account: string
  bik: string
  purpose: string
}

interface Props {
  open: boolean
  onClose: () => void
  registrationId: string
  title: string
  groups: PaymentGroup[]
  payment: PaymentDetails
  basePricePerDiscipline?: number | null
  clubDiscountPercent?: number | null
  onSuccess: () => void
}

export function PaymentModal({
  open,
  onClose,
  registrationId,
  title,
  groups,
  payment,
  basePricePerDiscipline,
  clubDiscountPercent,
  onSuccess,
}: Props) {
  const uploadInputId = useId()
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const entries = useMemo(() => groups.flatMap((group) => group.entries), [groups])
  const discountedUnitPrice = entries[0]?.price ?? 0
  const hasDiscount =
    basePricePerDiscipline != null &&
    hasClubDiscount(basePricePerDiscipline, discountedUnitPrice)
  const totalAmount = entries.reduce((sum, entry) => sum + entry.price, 0)
  const originalTotalAmount = hasDiscount
    ? originalAmountForEntries(entries.length, basePricePerDiscipline!)
    : null
  const savingsAmount =
    originalTotalAmount != null ? Math.max(0, originalTotalAmount - totalAmount) : 0

  useEffect(() => {
    if (!open) {
      setFile(null)
      setMessage('')
    }
  }, [open])

  const cardDigits = getCardNumberCopyValue(payment.cardNumber)
  const showCardPayment = Boolean(cardDigits)
  const isTeamPayment = groups.length > 1

  const submit = async () => {
    if (!file) {
      setMessage('Выберите файл квитанции.')
      return
    }

    setUploading(true)
    setMessage('')
    const form = new FormData()
    form.append('file', file)
    form.append('entryIds', JSON.stringify(entries.map((entry) => entry.id)))

    const result = await readJsonResponse<{ error?: string }>(
      await fetch(withBasePath(`/api/registrations/${registrationId}/payment-proof`), {
        method: 'POST',
        body: form,
      }),
    )
    setUploading(false)

    if (!result.ok) {
      setMessage(
        getRegistrationPublicErrorMessage(
          (result.body as { error?: string } | undefined)?.error,
          'Не удалось отправить квитанцию.',
        ),
      )
      return
    }

    setFile(null)
    onSuccess()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      ariaLabelledBy="payment-modal-title"
    >
      <div className="payment-modal flex max-h-[92dvh] w-full flex-col overflow-hidden">
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5">
          <h2 id="payment-modal-title" className="m-0 text-lg font-extrabold leading-snug text-foreground">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 border-0 bg-transparent text-sm text-muted"
            onClick={onClose}
          >
            Закрыть
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4 [-webkit-overflow-scrolling:touch]">
          {hasDiscount && clubDiscountPercent && (
            <div className="payment-discount-banner" role="status">
              <span className="payment-discount-badge">−{clubDiscountPercent}%</span>
              <span className="payment-discount-text">
                Скидка клуба применена
                {savingsAmount > 0 ? ` · экономия ${formatMoney(savingsAmount, { plus: false })}` : ''}
              </span>
            </div>
          )}

          <div
            className="rounded-xl border-2 border-[rgb(from_var(--color-accent)_r_g_b/0.45)] bg-accent-soft px-4 py-3.5 shadow-[inset_0_0_0_1px_rgb(from_var(--color-accent)_r_g_b/0.08)]"
            role="alert"
          >
            <p className="m-0 text-[0.9375rem] font-extrabold leading-snug text-accent">
              Комментарий к переводу не нужен
            </p>
            <p className="mt-1.5 mb-0 text-[0.8125rem] leading-snug text-foreground">
              {PAYMENT_NO_COMMENT_NOTE}
            </p>
          </div>

          <section
            className="rounded-xl border border-border bg-surface px-4 py-3.5"
            aria-label="Состав оплаты"
          >
            {isTeamPayment ? (
              <ul className="m-0 list-none p-0">
                {groups.map((group) => {
                  const disciplineCount = new Set(group.entries.map((entry) => entry.discipline)).size
                  const groupAmount = group.entries.reduce((sum, entry) => sum + entry.price, 0)
                  const groupOriginalAmount = hasDiscount
                    ? originalAmountForEntries(group.entries.length, basePricePerDiscipline!)
                    : null
                  return (
                    <li
                      key={group.title}
                      className="flex items-start justify-between gap-3 border-b border-border py-2.5 first:pt-0 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <span className="block text-[0.9375rem] font-semibold text-foreground">
                          {group.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {pluralDisciplines(disciplineCount)} · {pluralCategories(group.entries.length)}
                          {hasDiscount && basePricePerDiscipline && (
                            <>
                              {' · '}
                              <span className="inline-flex items-center gap-1">
                                <PriceWithDiscount
                                  amount={discountedUnitPrice}
                                  originalAmount={basePricePerDiscipline}
                                  size="sm"
                                />
                                {' '}за кат.
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                      <PriceWithDiscount
                        amount={groupAmount}
                        originalAmount={groupOriginalAmount}
                        size="md"
                        align="right"
                        className="shrink-0 text-accent"
                      />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="m-0 text-sm text-muted">
                {(() => {
                  const group = groups[0]
                  if (!group) return null
                  const disciplineCount = new Set(group.entries.map((entry) => entry.discipline)).size
                  return (
                    <>
                      <p>
                        {pluralDisciplines(disciplineCount)} · {pluralCategories(group.entries.length)}
                      </p>
                      {hasDiscount && basePricePerDiscipline && (
                        <p className="mt-1.5 text-[0.8125rem] text-muted">
                          <PriceWithDiscount
                            amount={discountedUnitPrice}
                            originalAmount={basePricePerDiscipline}
                            size="sm"
                          />
                          {' '}за категорию
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-4 border-t border-border pt-3 text-[0.9375rem]">
              <span>К оплате</span>
              <PriceWithDiscount
                amount={totalAmount}
                originalAmount={originalTotalAmount}
                size="lg"
                align="right"
                className="text-accent [&_strong]:text-[1.375rem] [&_strong]:font-extrabold [&_strong]:tabular-nums [&_strong]:text-accent"
              />
            </div>
          </section>

          <section
            className="flex flex-col gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5"
            aria-label="Реквизиты"
          >
            <p className="m-0 text-[0.8125rem] font-bold text-foreground">Реквизиты для перевода</p>
            <p className="m-0 text-[0.8125rem] font-semibold text-muted">
              {payment.recipientName}
              {payment.bankName ? ` · ${payment.bankName}` : ''}
            </p>
            <div className="flex flex-col gap-2">
              {showCardPayment && (
                <CopyChip
                  label="Карта"
                  displayValue={formatCardNumber(payment.cardNumber)}
                  copyValue={cardDigits}
                  spaced
                />
              )}
              {payment.phoneNumber && (
                <CopyChip
                  label="Телефон"
                  displayValue={formatPaymentPhone(payment.phoneNumber)}
                  copyValue={getPhoneCopyValue(payment.phoneNumber)}
                />
              )}
            </div>
            {payment.phoneNumber && <PaymentSberQuickPay phoneNumber={payment.phoneNumber} />}
          </section>
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-5 pt-3.5 pb-5 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <section className="flex flex-col gap-3" aria-label="Квитанция">
            <label htmlFor={uploadInputId} className="payment-upload-label">
              <span className="payment-upload-title">Квитанция об оплате</span>
              <span className="payment-upload-button">
                {file ? file.name : 'Выбрать файл (JPG, PNG или PDF)'}
              </span>
            </label>
            <Input
              controlOnly
              id={uploadInputId}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              className="payment-upload-input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {message && <p className="m-0 text-[0.8125rem] font-medium text-danger-foreground">{message}</p>}
            <Button type="button" className="min-h-11 w-full" onClick={submit} disabled={uploading}>
              {uploading ? 'Отправка…' : 'Отправить квитанцию'}
            </Button>
          </section>
        </footer>
      </div>
    </Modal>
  )
}

function CopyChip({
  label,
  displayValue,
  copyValue,
  spaced = false,
}: {
  label: string
  displayValue: string
  copyValue: string
  spaced?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="payment-copy-chip"
      onClick={copy}
      aria-label={copied ? `${label} скопирован` : `Скопировать ${label.toLowerCase()}`}
    >
      <span className="payment-copy-chip-header">
        <span className="payment-copy-chip-label">{label}</span>
        <span
          className={cn('payment-copy-chip-action', copied && 'payment-copy-chip-action--copied')}
          aria-live="polite"
        >
          {copied ? (
            <>
              <svg
                className="payment-copy-chip-check"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3.25-3.25a1 1 0 1 1 1.414-1.414l2.543 2.543 6.543-6.543a1 1 0 0 1 1.412 0Z"
                  clipRule="evenodd"
                />
              </svg>
              Скопировано
            </>
          ) : (
            'Скопировать'
          )}
        </span>
      </span>
      <span className={cn('payment-copy-chip-value', spaced && 'payment-copy-chip-value--spaced')}>
        {displayValue}
      </span>
    </Button>
  )
}
