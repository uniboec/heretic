import type { EntryPaymentStatus, RegistrationStatus } from './status'
import {
  isEntryEligibleForParticipation,
  isEntryConfirmedForPublic,
} from './status'
import { prisma } from '../prisma'
import { getCurrentRegistrationStage, getServerNow } from './time'
import { getRegistrationScheduleSync } from './schedule'

export function aggregateEntryPaymentStatus(
  statuses: EntryPaymentStatus[],
): EntryPaymentStatus {
  if (statuses.length === 0) return 'UNPAID'
  if (statuses.every((s) => s === 'PAID')) return 'PAID'
  if (statuses.every((s) => s === 'ADMITTED_WITHOUT_PAYMENT')) return 'ADMITTED_WITHOUT_PAYMENT'
  if (statuses.every((s) => s === 'DEBT')) return 'DEBT'
  if (statuses.every((s) => isEntryEligibleForParticipation(s))) return 'PAID'
  if (statuses.some((s) => s === 'PAYMENT_REVIEW')) return 'PAYMENT_REVIEW'
  return 'UNPAID'
}

export function summarizeEntryPayments(statuses: EntryPaymentStatus[]) {
  let paid = 0
  let admitted = 0
  let debt = 0
  let review = 0
  let unpaid = 0
  for (const status of statuses) {
    if (status === 'PAID') paid += 1
    else if (status === 'ADMITTED_WITHOUT_PAYMENT') admitted += 1
    else if (status === 'DEBT') debt += 1
    else if (status === 'PAYMENT_REVIEW') review += 1
    else unpaid += 1
  }
  return { paid, admitted, debt, review, unpaid, total: statuses.length }
}

export function registrationStatusFromEntries(
  statuses: EntryPaymentStatus[],
): RegistrationStatus {
  if (statuses.length === 0) return 'AWAITING_PAYMENT'
  if (statuses.every((s) => isEntryEligibleForParticipation(s))) {
    return 'PAID'
  }

  const aggregate = aggregateEntryPaymentStatus(statuses)
  switch (aggregate) {
    case 'PAID':
    case 'ADMITTED_WITHOUT_PAYMENT':
    case 'DEBT':
      return 'PAID'
    case 'PAYMENT_REVIEW':
      return 'PAYMENT_REVIEW'
    default:
      return 'AWAITING_PAYMENT'
  }
}

export function canSubmitPaymentForEntry(status: EntryPaymentStatus): boolean {
  return status === 'UNPAID'
}

export function matchesPublicPaidPaymentFilter(
  rawStatus: EntryPaymentStatus,
  filterStatus: string,
): boolean {
  if (filterStatus === 'PAID') {
    return isEntryConfirmedForPublic(rawStatus)
  }
  return rawStatus === filterStatus
}

export function getStagePrice(stageId: string): number {
  return getRegistrationScheduleSync().stagesById[stageId]?.pricePerDiscipline ?? 0
}

export function getCurrentPaymentStage(): {
  stageId: string
  pricePerDiscipline: number
  label: string
} | null {
  const now = getServerNow()
  const stageId = getCurrentRegistrationStage(now)
  if (!stageId) return null
  const stage = getRegistrationScheduleSync().stagesById[stageId]
  return {
    stageId,
    pricePerDiscipline: stage.pricePerDiscipline,
    label: stage.label,
  }
}

async function reconcileOrphanPendingProofs(registrationId: string): Promise<void> {
  const pendingProofs = await prisma.paymentProof.findMany({
    where: { registrationId, status: 'pending' },
    include: { entries: { select: { entryId: true } } },
  })

  for (const proof of pendingProofs) {
    if (proof.entries.length > 0) continue

    await prisma.paymentProof.update({
      where: { id: proof.id },
      data: {
        status: 'rejected',
        reviewedAt: new Date(),
        adminComment: 'Автоматически отклонено: связанные категории удалены из заявки',
      },
    })
  }
}

export async function syncRegistrationTotals(registrationId: string): Promise<void> {
  const entries = await prisma.athleteEntry.findMany({
    where: { athlete: { registrationId } },
    select: { price: true, paymentStatus: true },
  })

  const totalAmount = entries.reduce((sum, entry) => sum + entry.price, 0)
  const status = registrationStatusFromEntries(
    entries.map((entry) => entry.paymentStatus as EntryPaymentStatus),
  )

  await prisma.teamRegistration.update({
    where: { id: registrationId },
    data: { totalAmount, status },
  })

  await reconcileOrphanPendingProofs(registrationId)
}

export function entryCategoryKey(entry: {
  discipline: string
  ageDivisionId: string
  weightCategoryId: string
  experienceLevel: string
}): string {
  return `${entry.discipline}:${entry.ageDivisionId}:${entry.weightCategoryId}:${entry.experienceLevel}`
}
