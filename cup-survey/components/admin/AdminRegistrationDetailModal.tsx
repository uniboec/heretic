'use client'

import { useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { routes } from '@/lib/routes'
import { formatMoney } from '@/lib/formatMoney'
import { Button } from '@/components/ui/Button'
import { Modal, modalContentEnter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { cn } from '@/lib/cn'
import {
  adminBadgeVariant,
  adminFieldLabel,
  adminModal,
  adminModalBody,
  adminModalClose,
  adminModalEyebrow,
  adminModalFooter,
  adminModalHead,
  adminModalRegistration,
  adminModalSectionTitle,
  adminModalSubtitle,
  adminModalTitle,
  adminModalWide,
  adminRegistrationAthleteCard,
  adminRegistrationAthletes,
  adminRegistrationContacts,
  adminRegistrationEditLink,
  adminRegistrationEntryItem,
  adminRegistrationEntryList,
  adminRegistrationModalBody,
  adminRegistrationProofItem,
  adminRegistrationProofList,
  adminRegistrationSection,
  adminRegistrationTotal,
} from '@/lib/ui/adminSurfaceStyles'
import { formatAthleteFullName } from '@/lib/registration/athleteName'
import type { ExperienceLevelId } from '@/lib/config/experienceLevel'
import { getTournamentCategoryLabel } from '@/lib/registration/categoryRules'
import { getEntryPaymentStatusLabel, type EntryPaymentStatus } from '@/lib/registration/status'
import type { RegistrationStatus } from '@/lib/registration/status'
import { ProofReviewStatusBadge } from '@/components/ui/ProofReviewStatusBadge'
import { RegistrationStatusBadge } from './RegistrationStatusBadge'
import { AdminEditCodePanel } from './AdminEditCodePanel'
import { AdminConfirmEntryPaymentModal } from './AdminConfirmEntryPaymentModal'
import { AdminMarkEntryDebtModal } from './AdminMarkEntryDebtModal'
import { AdminEntryPaymentActions } from './AdminEntryPaymentActions'
import type { AdminAthleteDetail } from './AdminAthleteEditModal'
import type { AdminPaymentProofDetail } from './AdminPaymentProofModal'

export interface AdminRegistrationRow {
  id: string
  publicNumber: number
  createdAt: string
  clubName: string
  city: string
  athletesCount: number
  entryCount: number
  totalAmount: number
  status: RegistrationStatus
  hasProof: boolean
}

export interface AdminRegistrationDetail {
  clubName: string
  city: string
  phone: string
  email: string | null
  totalAmount: number
  pricePerDiscipline: number
  editToken: string
  hasEditCode: boolean
  athletes: AdminAthleteDetail[]
  paymentProofs: AdminPaymentProofDetail[]
}

interface Props {
  open: boolean
  registration: AdminRegistrationRow | null
  detail: AdminRegistrationDetail | null
  loading: boolean
  onClose: () => void
  onCancelRegistration: () => void
  onAddAthlete: () => void
  onEditAthlete: (athlete: AdminAthleteDetail) => void
  onDeleteAthlete: (athlete: AdminAthleteDetail) => void
  onUpdateEntryStatus: (entryId: string, paymentStatus: string) => void
  onReviewProof: (proof: AdminPaymentProofDetail) => void
  onEditCodeUpdated?: () => void
  onPaymentConfirmed?: () => void
  onConfirmPayment?: (input: {
    entryId: string
    paymentStageId: string
    paidAt: string
    comment: string
    withoutProof: boolean
    impactToken?: string
  }) => Promise<Response>
  onMarkDebt?: (input: {
    entryId: string
    paymentStageId: string
    impactToken?: string
  }) => Promise<Response>
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

function proofStatusBadge(status: string) {
  if (status === 'approved') return adminBadgeVariant('success')
  if (status === 'rejected') return adminBadgeVariant('danger')
  return adminBadgeVariant('warning')
}

function proofStatusText(status: string): string {
  if (status === 'approved') return 'Подтверждена'
  if (status === 'rejected') return 'Отклонена'
  return 'На проверке'
}

export function AdminRegistrationDetailModal({
  open,
  registration,
  detail,
  loading,
  onClose,
  onCancelRegistration,
  onAddAthlete,
  onEditAthlete,
  onDeleteAthlete,
  onUpdateEntryStatus,
  onReviewProof,
  onEditCodeUpdated,
  onPaymentConfirmed,
  onConfirmPayment,
  onMarkDebt,
}: Props) {
  const [confirmingEntryId, setConfirmingEntryId] = useState<string | null>(null)
  const [confirmPresetStageId, setConfirmPresetStageId] = useState<string | null>(null)
  const [markingDebtEntryId, setMarkingDebtEntryId] = useState<string | null>(null)

  if (!registration) return null

  const pendingProof = detail?.paymentProofs.find((proof) => proof.status === 'pending') ?? null

  const openPaidConfirm = (entryId: string, presetStageId?: string | null) => {
    setConfirmPresetStageId(presetStageId ?? null)
    setConfirmingEntryId(entryId)
  }

  const openDebtConfirm = (entryId: string) => {
    setMarkingDebtEntryId(entryId)
  }
  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      panelClassName={cn(adminModal, adminModalWide, adminModalRegistration)}
      ariaLabelledBy="admin-registration-modal-title"
    >
      <header className={adminModalHead}>
        <div className="min-w-0">
          <p className={adminModalEyebrow}>Заявка</p>
          <h2 id="admin-registration-modal-title" className={adminModalTitle}>
            №{registration.publicNumber} · {registration.clubName}
          </h2>
          <p className={adminModalSubtitle}>
            {registration.city} · {formatDateTime(registration.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <RegistrationStatusBadge status={registration.status} />
          <Button type="button" variant="ghost" className={adminModalClose} onClick={onClose} aria-label="Закрыть">
            ✕
          </Button>
        </div>
      </header>

      <div className={cn(adminModalBody, adminRegistrationModalBody)}>
        {loading && <ModalSkeleton rows={4} />}

        {detail && !loading && (
          <div className={modalContentEnter}>
            <section className={adminRegistrationSection}>
              <dl className={adminRegistrationContacts}>
                <div>
                  <dt className={adminFieldLabel}>Телефон</dt>
                  <dd className="mt-1 font-medium">{detail.phone}</dd>
                </div>
                {detail.email && (
                  <div>
                    <dt className={adminFieldLabel}>Email</dt>
                    <dd className="mt-1 font-medium">{detail.email}</dd>
                  </div>
                )}
              </dl>
            </section>

            <AdminEditCodePanel
              registrationId={registration.id}
              hasEditCode={detail.hasEditCode}
              onUpdated={onEditCodeUpdated}
            />

            {detail.paymentProofs.length > 0 && (
              <section className={adminRegistrationSection}>
                <h3 className={adminModalSectionTitle}>Квитанции</h3>
                <ul className={adminRegistrationProofList}>
                  {detail.paymentProofs.map((proof) => (
                    <li key={proof.id} className={adminRegistrationProofItem}>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                        <ProofReviewStatusBadge status={proof.status} label={proofStatusText(proof.status)} />
                          {proof.amount != null ? ` · ${formatMoney(proof.amount, { plus: false })}` : ''}
                        </p>
                        <p className="text-xs text-muted">{proof.entries.length} кат.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={proofStatusBadge(proof.status)}>{proofStatusText(proof.status)}</span>
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-9 px-3 py-1.5 text-xs"
                          onClick={() => onReviewProof(proof)}
                        >
                          {proof.status === 'pending' ? 'Проверить' : 'Открыть'}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                {pendingProof && (
                  <Button type="button" className="mt-3" onClick={() => onReviewProof(pendingProof)}>
                    Проверить последнюю квитанцию
                  </Button>
                )}
              </section>
            )}

            <section className={adminRegistrationSection}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className={adminModalSectionTitle}>Спортсмены</h3>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-9 px-3 py-1.5 text-xs"
                  onClick={onAddAthlete}
                >
                  Добавить спортсмена
                </Button>
              </div>
              <div className={adminRegistrationAthletes}>
                {detail.athletes.map((athlete) => (
                  <article key={athlete.id} className={adminRegistrationAthleteCard}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">
                          {formatAthleteFullName({
                            lastName: athlete.lastName,
                            firstName: athlete.firstName,
                            middleName: athlete.middleName,
                          })}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {athlete.birthDate} · {athlete.gender === 'male' ? 'М' : 'Ж'}
                          {athlete.rank ? ` · ${athlete.rank}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-9 px-3 py-1.5 text-xs"
                          onClick={() => onEditAthlete(athlete)}
                        >
                          Редактировать
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-9 px-3 py-1.5 text-xs text-danger hover:bg-danger-soft"
                          onClick={() => onDeleteAthlete(athlete)}
                        >
                          Удалить
                        </Button>
                      </div>
                    </div>
                    <ul className={adminRegistrationEntryList}>
                      {athlete.entries.map((entry) => (
                        <li key={entry.id} className={adminRegistrationEntryItem}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm text-foreground">
                              {entry.ageDivisionId && entry.weightCategoryId
                                ? getTournamentCategoryLabel(
                                    entry.ageDivisionId,
                                    entry.weightCategoryId,
                                    entry.experienceLevel as ExperienceLevelId,
                                  )
                                : `${entry.discipline} · категория не указана`}
                            </p>
                            <p className="text-sm font-semibold text-accent">
                              {formatMoney(entry.price ?? 0, { plus: false })}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <AdminEntryPaymentActions
                              entry={{
                                id: entry.id ?? '',
                                paymentStatus: entry.paymentStatus ?? 'UNPAID',
                                paymentStatusLabel:
                                  entry.paymentStatusLabel ??
                                  getEntryPaymentStatusLabel(
                                    (entry.paymentStatus ?? 'UNPAID') as EntryPaymentStatus,
                                  ),
                                graceEligibleStageId: entry.graceEligibleStageId,
                                graceEligibleStageLabel: entry.graceEligibleStageLabel,
                                gracePrice: entry.gracePrice,
                              }}
                              selectOnly
                              stacked
                              onUpdate={onUpdateEntryStatus}
                              onRequestPaidConfirm={openPaidConfirm}
                              onRequestDebtConfirm={openDebtConfirm}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className={adminRegistrationSection}>
              <p className={adminRegistrationTotal}>
                Итого: <strong>{formatMoney(detail.totalAmount, { plus: false })}</strong>
              </p>
              <p className={cn(adminRegistrationEditLink, 'break-all text-xs text-muted')}>
                Ссылка редактирования: {withBasePath(routes.edit(detail.editToken))}
              </p>
            </section>
          </div>
        )}
      </div>

      <footer className={adminModalFooter}>
        <Button type="button" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={onCancelRegistration}>
          Отменить заявку
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>Закрыть</Button>
      </footer>
    </Modal>

    <AdminConfirmEntryPaymentModal
      open={Boolean(confirmingEntryId)}
      entryId={confirmingEntryId}
      presetStageId={confirmPresetStageId}
      layer="nested"
      onClose={() => {
        setConfirmingEntryId(null)
        setConfirmPresetStageId(null)
      }}
      onConfirmed={(_update) => {
        setConfirmingEntryId(null)
        setConfirmPresetStageId(null)
        onPaymentConfirmed?.()
      }}
      onSubmit={onConfirmPayment}
    />

    <AdminMarkEntryDebtModal
      open={Boolean(markingDebtEntryId)}
      entryId={markingDebtEntryId}
      layer="nested"
      onClose={() => setMarkingDebtEntryId(null)}
      onConfirmed={(_update) => {
        setMarkingDebtEntryId(null)
        onPaymentConfirmed?.()
      }}
      onSubmit={onMarkDebt}
    />
    </>
  )
}
