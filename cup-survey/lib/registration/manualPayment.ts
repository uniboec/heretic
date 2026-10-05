import { PREVIOUS_STAGE_GRACE_HOURS, TOURNAMENT_TIMEZONE } from '../config/tournament'
import type { ExperienceLevelId } from '../config/experienceLevel'
import { getTournamentCategoryLabel } from './categoryRules'
import { listActiveCategoryDiscountRules } from './categoryDiscounts'
import { prisma } from '../prisma'
import { syncRegistrationTotals } from './entryPayment'
import { resolveEntryPrice, type CategoryDiscountRuleLike } from './pricing'
import { getRegistrationScheduleSync } from './schedule'
import { resolveRegistrationStageId, getStageSortIndex } from './registrationStageId'

export { resolveRegistrationStageId, getStageSortIndex } from './registrationStageId'
import type { EntryPaymentStatus } from './status'
import { getCurrentRegistrationStage, getServerNow } from './time'

export interface ManualPaymentStageOption {
  id: string
  label: string
  pricePerDiscipline: number
  bannerDetail: string
}

export interface EntryManualPaymentContext {
  entryId: string
  categoryLabel: string
  paymentStatus: EntryPaymentStatus
  currentPrice: number
  registrationId: string
  registrationStageId: string
  registrationPublicNumber: number
  clubName: string
  graceEligibleStageId: string | null
  graceEligibleStageLabel: string | null
  gracePrice: number | null
  defaultPaymentStageId: string
  defaultPaidAt: string
  stages: Array<ManualPaymentStageOption & { previewPrice: number }>
}

function formatTournamentDateYmd(date: Date): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TOURNAMENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}`
}

function parseStageEndMs(stageId: string): number | null {
  const stage = getRegistrationScheduleSync().stagesById[stageId]
  if (!stage) return null
  return new Date(stage.endsAt).getTime()
}

export function isWithinGraceAfterStage(stageId: string, now = getServerNow()): boolean {
  const endMs = parseStageEndMs(stageId)
  if (endMs == null) return false
  const graceMs = PREVIOUS_STAGE_GRACE_HOURS * 60 * 60 * 1000
  return now.getTime() <= endMs + graceMs
}

export function getGraceEligiblePaymentStageId(
  registrationStageId: string,
  paymentStatus: EntryPaymentStatus,
  now = getServerNow(),
): string | null {
  if (paymentStatus !== 'UNPAID') return null

  const currentStageId = getCurrentRegistrationStage(now)
  if (!currentStageId) return null
  const resolvedRegistrationStageId = resolveRegistrationStageId(registrationStageId)
  if (resolvedRegistrationStageId === currentStageId) return null
  if (
    getStageSortIndex(resolvedRegistrationStageId) >= getStageSortIndex(currentStageId)
  ) {
    return null
  }
  if (!isWithinGraceAfterStage(resolvedRegistrationStageId, now)) return null

  return resolvedRegistrationStageId
}

export function getManualPaymentStageOptions(
  _registrationStageId: string,
  _now = getServerNow(),
): ManualPaymentStageOption[] {
  const schedule = getRegistrationScheduleSync()

  return schedule.stages.map((stage) => ({
    id: stage.id,
    label: stage.label,
    pricePerDiscipline: stage.pricePerDiscipline,
    bannerDetail: stage.bannerDetail,
  }))
}

export function getDefaultManualPaymentStageId(
  registrationStageId: string,
  paymentStatus: EntryPaymentStatus,
  now = getServerNow(),
): string {
  const graceStageId = getGraceEligiblePaymentStageId(registrationStageId, paymentStatus, now)
  if (graceStageId) return graceStageId
  const resolvedRegistrationStageId = resolveRegistrationStageId(registrationStageId)
  return getCurrentRegistrationStage(now) ?? resolvedRegistrationStageId
}

export function getDefaultPaidAtDate(paymentStageId: string, now = getServerNow()): string {
  const stage = getRegistrationScheduleSync().stagesById[paymentStageId]
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const yesterdayYmd = formatTournamentDateYmd(yesterday)
  if (!stage) return yesterdayYmd

  const stageEndYmd = formatTournamentDateYmd(new Date(stage.endsAt))
  return yesterdayYmd <= stageEndYmd ? yesterdayYmd : stageEndYmd
}

export function resolveEntryPriceForPaymentStage(
  stageId: string,
  entry: {
    discipline: string
    experienceLevel: string
    ageDivisionId: string | null
  },
  clubDiscountPercent: number | null | undefined,
  rules: CategoryDiscountRuleLike[],
): number {
  const basePrice = getRegistrationScheduleSync().stagesById[stageId]?.pricePerDiscipline ?? 0
  return resolveEntryPrice(
    basePrice,
    {
      discipline: entry.discipline,
      experienceLevel: entry.experienceLevel,
      ageDivisionId: entry.ageDivisionId,
    },
    rules,
    clubDiscountPercent,
  )
}

function parsePaidAtDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) throw new Error('INVALID_PAID_AT')

  const [, year, month, day] = match
  const paidAt = new Date(`${year}-${month}-${day}T12:00:00+05:00`)
  if (Number.isNaN(paidAt.getTime())) throw new Error('INVALID_PAID_AT')
  return paidAt
}

function appendRegistrationAdminComment(existing: string | null, note: string): string {
  const trimmed = note.trim()
  if (!trimmed) return existing?.trim() ?? ''
  if (!existing?.trim()) return trimmed
  return `${existing.trim()}\n${trimmed}`
}

export function getEntryGraceSummary(
  entry: {
    discipline: string
    experienceLevel: string
    ageDivisionId: string | null
    paymentStatus: EntryPaymentStatus
  },
  registrationStageId: string,
  clubDiscountPercent: number | null | undefined,
  rules: CategoryDiscountRuleLike[],
  now = getServerNow(),
): {
  graceEligibleStageId: string | null
  graceEligibleStageLabel: string | null
  gracePrice: number | null
} {
  const graceEligibleStageId = getGraceEligiblePaymentStageId(
    registrationStageId,
    entry.paymentStatus,
    now,
  )
  if (!graceEligibleStageId) {
    return {
      graceEligibleStageId: null,
      graceEligibleStageLabel: null,
      gracePrice: null,
    }
  }

  const stage = getRegistrationScheduleSync().stagesById[graceEligibleStageId]
  return {
    graceEligibleStageId,
    graceEligibleStageLabel: stage?.label ?? null,
    gracePrice: resolveEntryPriceForPaymentStage(
      graceEligibleStageId,
      entry,
      clubDiscountPercent,
      rules,
    ),
  }
}

export async function buildEntryManualPaymentContext(entryId: string): Promise<EntryManualPaymentContext | null> {
  const entry = await prisma.athleteEntry.findUnique({
    where: { id: entryId },
    include: {
      athlete: {
        select: {
          registration: {
            select: {
              id: true,
              publicNumber: true,
              registrationStage: true,
              clubName: true,
              club: { select: { discountPercent: true } },
            },
          },
        },
      },
    },
  })
  if (!entry) return null

  const registration = entry.athlete.registration
  const rules = await listActiveCategoryDiscountRules()
  const clubDiscountPercent = registration.club?.discountPercent
  const resolvedRegistrationStageId = resolveRegistrationStageId(registration.registrationStage)
  const stages = getManualPaymentStageOptions(resolvedRegistrationStageId).map((stage) => ({
    ...stage,
    previewPrice: resolveEntryPriceForPaymentStage(
      stage.id,
      entry,
      clubDiscountPercent,
      rules,
    ),
  }))

  const graceEligibleStageId = getGraceEligiblePaymentStageId(
    resolvedRegistrationStageId,
    entry.paymentStatus as EntryPaymentStatus,
  )
  const graceStage = graceEligibleStageId
    ? getRegistrationScheduleSync().stagesById[graceEligibleStageId]
    : null
  const defaultPaymentStageId = getDefaultManualPaymentStageId(
    resolvedRegistrationStageId,
    entry.paymentStatus as EntryPaymentStatus,
  )

  return {
    entryId: entry.id,
    categoryLabel:
      entry.ageDivisionId && entry.weightCategoryId
        ? getTournamentCategoryLabel(
            entry.ageDivisionId,
            entry.weightCategoryId,
            entry.experienceLevel as ExperienceLevelId,
          )
        : `${entry.discipline} · категория не указана`,
    paymentStatus: entry.paymentStatus as EntryPaymentStatus,
    currentPrice: entry.price,
    registrationId: registration.id,
    registrationStageId: resolvedRegistrationStageId,
    registrationPublicNumber: registration.publicNumber,
    clubName: registration.clubName,
    graceEligibleStageId,
    graceEligibleStageLabel: graceStage?.label ?? null,
    gracePrice: graceEligibleStageId
      ? resolveEntryPriceForPaymentStage(graceEligibleStageId, entry, clubDiscountPercent, rules)
      : null,
    defaultPaymentStageId,
    defaultPaidAt: getDefaultPaidAtDate(defaultPaymentStageId),
    stages,
  }
}

export async function confirmEntryPaymentAsAdmin(input: {
  entryId: string
  paymentStageId: string
  paidAt: string
  comment?: string
  withoutProof?: boolean
  impactToken?: string
}): Promise<{ price: number; paymentStageId: string; paidAt: string }> {
  const entry = await prisma.athleteEntry.findUnique({
    where: { id: input.entryId },
    include: {
      athlete: {
        select: {
          registration: {
            select: {
              id: true,
              registrationStage: true,
              adminComment: true,
              club: { select: { discountPercent: true } },
            },
          },
        },
      },
    },
  })
  if (!entry) throw new Error('NOT_FOUND')

  if (entry.paymentStatus === 'PAID') throw new Error('ALREADY_PAID')

  const allowedStages = getManualPaymentStageOptions(
    resolveRegistrationStageId(entry.athlete.registration.registrationStage),
  )
  const stage = allowedStages.find((item) => item.id === input.paymentStageId)
  if (!stage) throw new Error('INVALID_STAGE')

  const paidAt = parsePaidAtDate(input.paidAt)
  const now = getServerNow()
  if (paidAt.getTime() > now.getTime()) throw new Error('PAID_AT_IN_FUTURE')

  const rules = await listActiveCategoryDiscountRules()
  const clubDiscountPercent = entry.athlete.registration.club?.discountPercent
  const price = resolveEntryPriceForPaymentStage(
    input.paymentStageId,
    entry,
    clubDiscountPercent,
    rules,
  )

  const noteParts = [
    `Ручное подтверждение оплаты: ${stage.label}, ${price} ₽, дата ${input.paidAt}.`,
  ]
  if (input.withoutProof) noteParts.push('Без квитанции.')
  if (input.comment?.trim()) noteParts.push(input.comment.trim())

  const registrationId = entry.athlete.registration.id
  const { fingerprintConfirmPayment } = await import('./adminImpact')
  const { loadCategoryKeysForEntry } = await import('./bracketAutoSync')
  const { withBracketImpactAfterCommit } = await import('./bracketImpactCoordinator')
  const categoryKeys = await loadCategoryKeysForEntry(input.entryId)
  const mutationFingerprint = fingerprintConfirmPayment({
    entryId: input.entryId,
    paymentStageId: input.paymentStageId,
  })

  const result = await withBracketImpactAfterCommit(
    async (tx) => {
      const db = tx ?? prisma
      await db.athleteEntry.update({
        where: { id: entry.id },
        data: {
          paymentStatus: 'PAID',
          paymentStage: input.paymentStageId,
          price,
          paidAt,
        },
      })
      await db.teamRegistration.update({
        where: { id: registrationId },
        data: {
          adminComment: appendRegistrationAdminComment(
            entry.athlete.registration.adminComment,
            noteParts.join(' '),
          ),
        },
      })
      return {
        price,
        paymentStageId: input.paymentStageId,
        paidAt: paidAt.toISOString(),
      }
    },
    {
      registrationId,
      mutationFingerprint,
      categoryKeys,
      entryIds: [input.entryId],
      impactToken: input.impactToken,
    },
  )

  await syncRegistrationTotals(registrationId)
  return result
}

const MARK_DEBT_SOURCE_STATUSES: EntryPaymentStatus[] = [
  'UNPAID',
  'PAYMENT_REVIEW',
  'ADMITTED_WITHOUT_PAYMENT',
]

export async function markEntryDebtAsAdmin(input: {
  entryId: string
  paymentStageId: string
  impactToken?: string
}): Promise<{ price: number; paymentStageId: string }> {
  const entry = await prisma.athleteEntry.findUnique({
    where: { id: input.entryId },
    include: {
      paymentProofLinks: {
        include: { paymentProof: { select: { status: true } } },
      },
      athlete: {
        select: {
          registration: {
            select: {
              id: true,
              registrationStage: true,
              adminComment: true,
              club: { select: { discountPercent: true } },
            },
          },
        },
      },
    },
  })
  if (!entry) throw new Error('NOT_FOUND')

  const currentStatus = entry.paymentStatus as EntryPaymentStatus
  if (currentStatus === 'PAID' || currentStatus === 'DEBT') {
    throw new Error('INVALID_TRANSITION')
  }
  if (!MARK_DEBT_SOURCE_STATUSES.includes(currentStatus)) {
    throw new Error('INVALID_TRANSITION')
  }

  const hasPendingProof = entry.paymentProofLinks.some(
    (link) => link.paymentProof.status === 'pending',
  )
  if (hasPendingProof) throw new Error('PENDING_PROOF')

  const allowedStages = getManualPaymentStageOptions(
    resolveRegistrationStageId(entry.athlete.registration.registrationStage),
  )
  const stage = allowedStages.find((item) => item.id === input.paymentStageId)
  if (!stage) throw new Error('INVALID_STAGE')

  const rules = await listActiveCategoryDiscountRules()
  const clubDiscountPercent = entry.athlete.registration.club?.discountPercent
  const price = resolveEntryPriceForPaymentStage(
    input.paymentStageId,
    entry,
    clubDiscountPercent,
    rules,
  )

  const note = `Отмечен долг: ${stage.label}, ${price} ₽.`

  const registrationId = entry.athlete.registration.id
  const { fingerprintMarkDebt } = await import('./adminImpact')
  const { loadCategoryKeysForEntry } = await import('./bracketAutoSync')
  const { withBracketImpactAfterCommit } = await import('./bracketImpactCoordinator')
  const categoryKeys = await loadCategoryKeysForEntry(input.entryId)
  const mutationFingerprint = fingerprintMarkDebt({
    entryId: input.entryId,
    paymentStageId: input.paymentStageId,
  })

  const result = await withBracketImpactAfterCommit(
    async (tx) => {
      const db = tx ?? prisma
      await db.athleteEntry.update({
        where: { id: entry.id },
        data: {
          paymentStatus: 'DEBT',
          paymentStage: input.paymentStageId,
          price,
          paidAt: null,
        },
      })
      await db.teamRegistration.update({
        where: { id: registrationId },
        data: {
          adminComment: appendRegistrationAdminComment(
            entry.athlete.registration.adminComment,
            note,
          ),
        },
      })
      return {
        price,
        paymentStageId: input.paymentStageId,
      }
    },
    {
      registrationId,
      mutationFingerprint,
      categoryKeys,
      entryIds: [input.entryId],
      impactToken: input.impactToken,
    },
  )

  await syncRegistrationTotals(registrationId)
  return result
}
