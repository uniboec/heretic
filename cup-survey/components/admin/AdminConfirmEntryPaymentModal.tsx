'use client'

import { useEffect, useMemo, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { formatMoney } from '@/lib/formatMoney'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import {
  adminFieldLabel,
  adminInput,
  adminModal,
  adminModalBody,
  adminModalClose,
  adminModalErrors,
  adminModalFooter,
  adminModalHead,
  adminModalSubtitle,
  adminModalTitle,
} from '@/lib/ui/adminSurfaceStyles'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

interface PaymentOptions {
  entryId: string
  categoryLabel: string
  paymentStatus: string
  currentPrice: number
  registrationPublicNumber: number
  clubName: string
  graceEligibleStageId: string | null
  graceEligibleStageLabel: string | null
  defaultPaymentStageId: string
  defaultPaidAt: string
  stages: Array<{
    id: string
    label: string
    pricePerDiscipline: number
    bannerDetail: string
    previewPrice: number
  }>
}

interface Props {
  open: boolean
  entryId: string | null
  presetStageId?: string | null
  layer?: 'base' | 'nested'
  onClose: () => void
  onConfirmed: (result: {
    entryId: string
    price: number
    paymentStageId: string
    paymentStageLabel: string
    paidAt: string
  }) => void
  onSubmit?: (input: {
    entryId: string
    paymentStageId: string
    paidAt: string
    comment: string
    withoutProof: boolean
    impactToken?: string
  }) => Promise<Response>
}

export function AdminConfirmEntryPaymentModal({
  open,
  entryId,
  presetStageId,
  layer = 'base',
  onClose,
  onConfirmed,
  onSubmit,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [options, setOptions] = useState<PaymentOptions | null>(null)
  const [paymentStageId, setPaymentStageId] = useState('')
  const [paidAt, setPaidAt] = useState('')
  const [comment, setComment] = useState('')
  const [withoutProof, setWithoutProof] = useState(true)

  useEffect(() => {
    if (!open || !entryId) {
      setOptions(null)
      setError('')
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await readJsonResponse<PaymentOptions>(
          await fetch(withBasePath(`/api/admin/registrations/entries/${entryId}/confirm-payment`)),
        )
        if (!result.ok) {
          const code =
            result.body && typeof result.body === 'object' && 'error' in result.body
              ? String((result.body as { error?: string }).error)
              : undefined
          throw new Error(
            code === 'NOT_FOUND' ? 'Категория не найдена.' : result.error,
          )
        }
        if (cancelled) return
        const json = result.data
        setOptions(json)
        setPaymentStageId(presetStageId ?? json.defaultPaymentStageId)
        setPaidAt(json.defaultPaidAt)
        setComment('')
        setWithoutProof(true)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить параметры оплаты.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, entryId, presetStageId])

  const selectedStage = useMemo(
    () => options?.stages.find((stage) => stage.id === paymentStageId) ?? null,
    [options, paymentStageId],
  )

  const submit = async () => {
    if (!entryId || !paymentStageId || !paidAt) return
    setSubmitting(true)
    setError('')
    try {
      const response = onSubmit
        ? await onSubmit({
            entryId,
            paymentStageId,
            paidAt,
            comment,
            withoutProof,
          })
        : await fetch(withBasePath(`/api/admin/registrations/entries/${entryId}/confirm-payment`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentStageId,
              paidAt,
              comment,
              withoutProof,
            }),
          })

      const result = await readJsonResponse<{
        price?: number
        paymentStageId?: string
        paidAt?: string
        error?: string
      }>(
        response,
      )
      if (!result.ok) {
        const code =
          result.body && typeof result.body === 'object' && 'error' in result.body
            ? String((result.body as { error?: string }).error)
            : undefined
        throw new Error(
          code === 'ALREADY_PAID'
            ? 'Категория уже отмечена как оплаченная.'
            : result.error,
        )
      }
      onConfirmed({
        entryId,
        price: result.data.price ?? selectedStage?.previewPrice ?? options?.currentPrice ?? 0,
        paymentStageId: result.data.paymentStageId ?? paymentStageId,
        paymentStageLabel: selectedStage?.label ?? paymentStageId,
        paidAt: result.data.paidAt ?? paidAt,
      })
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось подтвердить оплату.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open && Boolean(entryId)}
      onClose={onClose}
      layer={layer}
      panelClassName={adminModal}
      ariaLabelledBy="admin-confirm-payment-title"
    >
      <header className={adminModalHead}>
        <div>
          <h2 id="admin-confirm-payment-title" className={adminModalTitle}>
            Подтвердить оплату
          </h2>
          {options && (
            <p className={adminModalSubtitle}>
              №{options.registrationPublicNumber} · {options.clubName} · {options.categoryLabel}
            </p>
          )}
        </div>
        <Button type="button" variant="ghost" className={adminModalClose} onClick={onClose}>
          Закрыть
        </Button>
      </header>

      <div className={cn(adminModalBody, 'space-y-4')}>
        {loading && <p className="text-sm text-muted">Загрузка…</p>}
        {!loading && options && (
          <>
            <label className="block">
              <span className={adminFieldLabel}>Этап регистрации</span>
              <select
                className={cn(adminInput, 'mt-1')}
                value={paymentStageId}
                onChange={(event) => setPaymentStageId(event.target.value)}
              >
                {options.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label} · {formatMoney(stage.previewPrice, { plus: false })}
                    {options.graceEligibleStageId === stage.id ? ' · льготный тариф' : ''}
                  </option>
                ))}
              </select>
              {selectedStage && (
                <p className="mt-1 text-xs text-muted">
                  Базовый тариф: {formatMoney(selectedStage.pricePerDiscipline, { plus: false })} ·{' '}
                  {selectedStage.bannerDetail}
                </p>
              )}
            </label>

            <label className="block">
              <span className={adminFieldLabel}>Дата оплаты</span>
              <Input
                controlOnly
                type="date"
                density="compact"
                className={cn(adminInput, 'mt-1')}
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </label>

            <label className="block">
              <span className={adminFieldLabel}>Комментарий</span>
              <textarea
                className={cn(adminInput, 'mt-1 min-h-[5rem]')}
                placeholder="Например: оплатил переводом, чек не успел загрузить"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-foreground">
              <Input
                controlOnly
                type="checkbox"
                className="mt-1 w-auto min-h-0 shrink-0 border-0 bg-transparent p-0 shadow-none"
                checked={withoutProof}
                onChange={(event) => setWithoutProof(event.target.checked)}
              />
              <span>Подтверждаю оплату без загруженной квитанции</span>
            </label>

            {options.currentPrice !== (selectedStage?.previewPrice ?? options.currentPrice) && (
              <p className="rounded-lg border border-border bg-accent-soft/40 px-3 py-2 text-sm text-foreground">
                Сумма изменится с {formatMoney(options.currentPrice, { plus: false })} на{' '}
                {formatMoney(selectedStage?.previewPrice ?? options.currentPrice, { plus: false })}.
              </p>
            )}
          </>
        )}
        {error && <p className={adminModalErrors}>{error}</p>}
      </div>

      <footer className={adminModalFooter}>
        <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
          Отмена
        </Button>
        <Button type="button" onClick={() => void submit()} disabled={submitting || loading || !options}>
          {submitting ? 'Сохранение…' : 'Подтвердить оплату'}
        </Button>
      </footer>
    </Modal>
  )
}
