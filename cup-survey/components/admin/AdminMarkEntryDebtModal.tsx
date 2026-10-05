'use client'

import { useEffect, useMemo, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { formatMoney } from '@/lib/formatMoney'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import {
  adminFieldLabel,
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

interface DebtOptions {
  entryId: string
  categoryLabel: string
  paymentStatus: string
  currentPrice: number
  registrationPublicNumber: number
  clubName: string
  defaultPaymentStageId: string
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
  layer?: 'base' | 'nested'
  onClose: () => void
  onConfirmed: (result: {
    entryId: string
    price: number
    paymentStageId: string
    paymentStageLabel: string
  }) => void
  onSubmit?: (input: {
    entryId: string
    paymentStageId: string
    impactToken?: string
  }) => Promise<Response>
}

export function AdminMarkEntryDebtModal({
  open,
  entryId,
  layer = 'base',
  onClose,
  onConfirmed,
  onSubmit,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [options, setOptions] = useState<DebtOptions | null>(null)
  const [paymentStageId, setPaymentStageId] = useState('')

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
        const result = await readJsonResponse<DebtOptions>(
          await fetch(withBasePath(`/api/admin/registrations/entries/${entryId}/mark-debt`)),
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
        setPaymentStageId(json.defaultPaymentStageId)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить параметры.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, entryId])

  const selectedStage = useMemo(
    () => options?.stages.find((stage) => stage.id === paymentStageId) ?? null,
    [options, paymentStageId],
  )

  const submit = async () => {
    if (!entryId || !paymentStageId) return
    setSubmitting(true)
    setError('')
    try {
      const response = onSubmit
        ? await onSubmit({ entryId, paymentStageId })
        : await fetch(withBasePath(`/api/admin/registrations/entries/${entryId}/mark-debt`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentStageId }),
          })

      const result = await readJsonResponse<{ price?: number; paymentStageId?: string; error?: string }>(
        response,
      )
      if (!result.ok) {
        const code =
          result.body && typeof result.body === 'object' && 'error' in result.body
            ? String((result.body as { error?: string }).error)
            : undefined
        throw new Error(
          code === 'INVALID_TRANSITION'
            ? 'Нельзя отметить долг для этой категории.'
            : code === 'PENDING_PROOF'
              ? 'Сначала завершите проверку квитанции.'
              : result.error,
        )
      }
      onConfirmed({
        entryId,
        price: result.data.price ?? selectedStage?.previewPrice ?? options?.currentPrice ?? 0,
        paymentStageId: result.data.paymentStageId ?? paymentStageId,
        paymentStageLabel: selectedStage?.label ?? paymentStageId,
      })
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось отметить долг.')
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
      ariaLabelledBy="admin-mark-debt-title"
    >
      <header className={adminModalHead}>
        <div>
          <h2 id="admin-mark-debt-title" className={adminModalTitle}>
            Отметить долг
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
        {!loading && options && options.stages.length === 0 && (
          <p className="text-sm text-muted">Нет доступных этапов для этой категории.</p>
        )}
        {!loading && options && options.stages.length > 0 && (
          <>
            <label className="block">
              <span className={adminFieldLabel}>Этап регистрации</span>
              <Select
                controlOnly
                density="compact"
                className="mt-1"
                value={paymentStageId}
                onChange={(event) => setPaymentStageId(event.target.value)}
              >
                {options.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label} · {formatMoney(stage.previewPrice, { plus: false })}
                  </option>
                ))}
              </Select>
              {selectedStage && (
                <p className="mt-1 text-xs text-muted">
                  Базовый тариф: {formatMoney(selectedStage.pricePerDiscipline, { plus: false })} ·{' '}
                  {selectedStage.bannerDetail}
                </p>
              )}
            </label>

            {options.currentPrice !== (selectedStage?.previewPrice ?? options.currentPrice) && (
              <p className="rounded-lg border border-border bg-accent-soft/40 px-3 py-2 text-sm text-foreground">
                Сумма долга изменится с {formatMoney(options.currentPrice, { plus: false })} на{' '}
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
        <Button type="button" onClick={() => void submit()} disabled={submitting || loading || !options || options.stages.length === 0}>
          {submitting ? 'Сохранение…' : 'Отметить долг'}
        </Button>
      </footer>
    </Modal>
  )
}
