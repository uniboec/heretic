'use client'

import { useEffect, useState } from 'react'
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
  adminModalSectionTitle,
  adminModalSubtitle,
  adminModalTitle,
  adminModalWide,
  adminProofEntries,
  adminProofEntry,
  adminProofFrame,
  adminProofImage,
  adminProofOpenLink,
  adminProofPreview,
  adminProofPreviewLink,
  adminProofPreviewMessage,
  adminProofPreviewMessageError,
} from '@/lib/ui/adminSurfaceStyles'
import { Textarea } from '@/components/ui/Textarea'
import { getEntryPaymentStatusLabel, type EntryPaymentStatus } from '@/lib/registration/status'

export interface AdminPaymentProofDetail {
  id: string
  status: string
  uploadedAt: string
  amount: number | null
  mimeType: string
  adminComment: string | null
  entries: Array<{
    id: string
    label: string
    athleteName: string
    paymentStatus: EntryPaymentStatus
  }>
}

interface Props {
  open: boolean
  registrationId: string
  proof: AdminPaymentProofDetail | null
  onClose: () => void
  onReviewed: () => void
  onReview?: (
    proof: AdminPaymentProofDetail,
    action: 'approve' | 'reject',
    comment: string,
  ) => Promise<boolean>
  layer?: 'base' | 'nested'
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function proofStatusLabel(status: string): string {
  if (status === 'approved') return 'Подтверждена'
  if (status === 'rejected') return 'Отклонена'
  return 'На проверке'
}

function previewErrorMessage(status: number): string {
  if (status === 404) {
    return 'Файл квитанции не найден на сервере. Возможно, он был утерян при предыдущем обновлении.'
  }
  return 'Не удалось загрузить квитанцию.'
}

export function AdminPaymentProofModal({
  open,
  registrationId,
  proof,
  onClose,
  onReviewed,
  onReview,
  layer = 'nested',
}: Props) {
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    if (!open) {
      setComment('')
      setError('')
      return
    }
    setComment(proof?.adminComment ?? '')
  }, [open, proof])

  const proofUrl = proof
    ? withBasePath(
        `/api/admin/registrations/${registrationId}/payment-proof?proofId=${proof.id}`,
      )
    : ''
  const mimeType = proof?.mimeType ?? ''
  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'
  const isPending = proof?.status === 'pending'

  useEffect(() => {
    if (!open || !proof || !proofUrl) {
      setPreviewUrl(null)
      setPreviewError('')
      setPreviewLoading(false)
      return
    }

    let activeObjectUrl: string | null = null
    let cancelled = false

    const loadPreview = async () => {
      setPreviewLoading(true)
      setPreviewError('')
      setPreviewUrl(null)

      try {
        const response = await fetch(proofUrl, { credentials: 'same-origin' })
        if (!response.ok) {
          throw new Error(previewErrorMessage(response.status))
        }

        const blob = await response.blob()
        if (cancelled) return

        activeObjectUrl = URL.createObjectURL(blob)
        setPreviewUrl(activeObjectUrl)
      } catch (loadError) {
        if (!cancelled) {
          setPreviewError(
            loadError instanceof Error ? loadError.message : 'Не удалось загрузить квитанцию.',
          )
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false)
        }
      }
    }

    void loadPreview()

    return () => {
      cancelled = true
      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl)
      }
    }
  }, [open, proof, proofUrl])

  const review = async (action: 'approve' | 'reject') => {
    if (!proof) return
    setSubmitting(true)
    setError('')
    const ok = onReview
      ? await onReview(proof, action, comment)
      : (
          await readJsonResponse(
            await fetch(withBasePath(`/api/admin/registrations/${registrationId}/review-payment`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, comment, proofId: proof.id }),
            }),
            { allowEmptySuccess: true },
          )
        ).ok
    setSubmitting(false)

    if (!ok) {
      if (!onReview) setError('Не удалось обработать квитанцию.')
      return
    }

    onReviewed()
    onClose()
  }

  return (
    <Modal
      open={open && Boolean(proof)}
      onClose={onClose}
      layer={layer}
      panelClassName={cn(adminModal, adminModalWide)}
      ariaLabelledBy="admin-proof-modal-title"
    >
      {proof && (
        <>
          <header className={adminModalHead}>
            <div>
              <h2 id="admin-proof-modal-title" className={adminModalTitle}>
                {isPending ? 'Проверка квитанции' : proof.status === 'approved' ? 'Квитанция об оплате' : 'Квитанция'}
              </h2>
              <p className={adminModalSubtitle}>
                {formatDateTime(proof.uploadedAt)}
                {proof.amount != null ? ` · ${formatMoney(proof.amount, { plus: false })}` : ''}
                {' · '}
                {proofStatusLabel(proof.status)}
              </p>
            </div>
            <Button type="button" variant="ghost" className={adminModalClose} onClick={onClose}>
              Закрыть
            </Button>
          </header>

          <div className={adminModalBody}>
            <section className={adminProofPreview} aria-label="Квитанция">
              {previewLoading && (
                <p className={adminProofPreviewMessage}>Загрузка квитанции…</p>
              )}
              {!previewLoading && previewError && (
                <p className={cn(adminProofPreviewMessage, adminProofPreviewMessageError)}>{previewError}</p>
              )}
              {!previewLoading && !previewError && previewUrl && isImage && (
                <img src={previewUrl} alt="Квитанция об оплате" className={adminProofImage} />
              )}
              {!previewLoading && !previewError && previewUrl && isPdf && (
                <iframe src={previewUrl} title="Квитанция об оплате" className={adminProofFrame} />
              )}
              {!previewLoading && !previewError && previewUrl && !isImage && !isPdf && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={adminProofPreviewLink}
                >
                  Открыть файл квитанции →
                </a>
              )}
            </section>

            <section aria-label="Категории в квитанции">
              <h3 className={adminModalSectionTitle}>Категории в оплате</h3>
              <ul className={adminProofEntries}>
                {proof.entries.map((entry) => (
                  <li key={entry.id} className={adminProofEntry}>
                    <div>
                      <p className="font-medium text-foreground">{entry.athleteName}</p>
                      <p className="text-sm text-muted">{entry.label}</p>
                    </div>
                    <span className="text-xs text-muted">
                      {getEntryPaymentStatusLabel(entry.paymentStatus)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {isPending && (
              <label className="block">
                <span className={adminFieldLabel}>Комментарий при отклонении</span>
                <Textarea
                  controlOnly
                  density="compact"
                  className="mt-1 min-h-[5rem]"
                  placeholder="Укажите причину, если отклоняете чек"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </label>
            )}

            {!isPending && proof.adminComment && (
              <p className="text-sm text-muted">Комментарий: {proof.adminComment}</p>
            )}

            {error && <p className={adminModalErrors}>{error}</p>}
          </div>

          {isPending ? (
            <footer className={adminModalFooter}>
              <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                Отмена
              </Button>
              <Button type="button" variant="secondary" onClick={() => review('reject')} disabled={submitting}>
                Отклонить
              </Button>
              <Button type="button" onClick={() => review('approve')} disabled={submitting}>
                {submitting ? 'Сохранение…' : 'Подтвердить оплату'}
              </Button>
            </footer>
          ) : (
            <footer className={adminModalFooter}>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={adminProofOpenLink}
                >
                  Открыть в новой вкладке
                </a>
              )}
              <Button type="button" variant="secondary" onClick={onClose}>
                Закрыть
              </Button>
            </footer>
          )}
        </>
      )}
    </Modal>
  )
}
