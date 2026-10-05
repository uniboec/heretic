import { prisma } from '../prisma'

import { getStageFromSchedule } from './schedule'

import { formatCategoryDiscountScope, formatCategoryDiscountTitle } from './categoryDiscountLabels'

import { syncRegistrationTotals } from './entryPayment'

import { resolveEntryPrice, type CategoryDiscountRuleLike } from './pricing'
import {
  getEffectiveBasePriceForUnpaidEntries,
  getEffectivePricePerDisciplineForUnpaidEntries,
} from './stagePricing'
import {
  isDiscountRuleScheduledActive,
  type CategoryDiscountRuleRecord,
} from './categoryDiscountTypes'

export type { CategoryDiscountRuleRecord } from './categoryDiscountTypes'
export { isDiscountRuleScheduledActive } from './categoryDiscountTypes'



export interface PublicCategoryDiscountPromotion {

  id: string

  title: string

  description: string | null

  discountPercent: number

  scope: string

  startsAt: string | null

  endsAt: string | null

}



const ruleSelect = {

  id: true,

  label: true,

  description: true,

  discountPercent: true,

  discipline: true,

  experienceLevel: true,

  ageDivisionId: true,

  enabled: true,

  showOnSite: true,

  startsAt: true,

  endsAt: true,

  sortOrder: true,

  createdAt: true,

  updatedAt: true,

} as const



function serializeRule(rule: {

  id: string

  label: string | null

  description: string | null

  discountPercent: number

  discipline: string | null

  experienceLevel: string | null

  ageDivisionId: string | null

  enabled: boolean

  showOnSite: boolean

  startsAt: Date | null

  endsAt: Date | null

  sortOrder: number

  createdAt: Date

  updatedAt: Date

}): CategoryDiscountRuleRecord {

  return {

    id: rule.id,

    label: rule.label,

    description: rule.description,

    discountPercent: rule.discountPercent,

    discipline: rule.discipline,

    experienceLevel: rule.experienceLevel,

    ageDivisionId: rule.ageDivisionId,

    enabled: rule.enabled,

    showOnSite: rule.showOnSite,

    startsAt: rule.startsAt?.toISOString() ?? null,

    endsAt: rule.endsAt?.toISOString() ?? null,

    sortOrder: rule.sortOrder,

    createdAt: rule.createdAt.toISOString(),

    updatedAt: rule.updatedAt.toISOString(),

  }

}



export class CategoryDiscountRuleError extends Error {

  constructor(public code: 'NOT_FOUND' | 'INVALID') {

    super(code)

  }

}



function normalizeDiscountPercent(value: number): number {

  if (!Number.isFinite(value)) throw new CategoryDiscountRuleError('INVALID')

  return Math.min(100, Math.max(0, Math.round(value)))

}



function normalizeOptionalId(value: string | null | undefined): string | null {

  const trimmed = value?.trim()

  return trimmed ? trimmed : null

}



function normalizeOptionalText(value: string | null | undefined): string | null {

  const trimmed = value?.trim()

  return trimmed ? trimmed : null

}



function parseScheduleDate(value: string | null | undefined): Date | null {

  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) throw new CategoryDiscountRuleError('INVALID')

  return date

}


function buildScheduleWhere(now = new Date()) {

  return {

    enabled: true,

    AND: [

      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },

      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },

    ],

  }

}



export async function listActiveCategoryDiscountRules(

  now = new Date(),

): Promise<CategoryDiscountRuleLike[]> {

  const rules = await prisma.categoryDiscountRule.findMany({

    where: buildScheduleWhere(now),

    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],

    select: {

      discountPercent: true,

      discipline: true,

      experienceLevel: true,

      ageDivisionId: true,

      enabled: true,

    },

  })

  return rules

}



export async function listPublicCategoryDiscountPromotions(

  now = new Date(),

): Promise<PublicCategoryDiscountPromotion[]> {

  const rules = await prisma.categoryDiscountRule.findMany({

    where: {

      ...buildScheduleWhere(now),

      showOnSite: true,

    },

    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],

    select: ruleSelect,

  })



  return rules.map((rule) => {

    const serialized = serializeRule(rule)

    return {

      id: serialized.id,

      title: formatCategoryDiscountTitle(serialized),

      description: serialized.description,

      discountPercent: serialized.discountPercent,

      scope: formatCategoryDiscountScope(serialized),

      startsAt: serialized.startsAt,

      endsAt: serialized.endsAt,

    }

  })

}



export async function listCategoryDiscountRulesAdmin(): Promise<CategoryDiscountRuleRecord[]> {

  const rules = await prisma.categoryDiscountRule.findMany({

    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],

    select: ruleSelect,

  })

  return rules.map(serializeRule)

}



type DiscountRuleInput = {

  label?: string | null

  description?: string | null

  discountPercent: number

  discipline?: string | null

  experienceLevel?: string | null

  ageDivisionId?: string | null

  enabled?: boolean

  showOnSite?: boolean

  startsAt?: string | null

  endsAt?: string | null

}



function normalizeDiscountRuleInput(input: DiscountRuleInput) {

  const startsAt = parseScheduleDate(input.startsAt)

  const endsAt = parseScheduleDate(input.endsAt)

  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {

    throw new CategoryDiscountRuleError('INVALID')

  }



  return {

    label: normalizeOptionalText(input.label),

    description: normalizeOptionalText(input.description),

    discountPercent: normalizeDiscountPercent(input.discountPercent),

    discipline: normalizeOptionalId(input.discipline),

    experienceLevel: normalizeOptionalId(input.experienceLevel),

    ageDivisionId: normalizeOptionalId(input.ageDivisionId),

    enabled: input.enabled ?? true,

    showOnSite: input.showOnSite ?? false,

    startsAt,

    endsAt,

  }

}



export async function createCategoryDiscountRule(

  input: DiscountRuleInput,

): Promise<CategoryDiscountRuleRecord> {

  const normalized = normalizeDiscountRuleInput(input)

  if (normalized.discountPercent <= 0) throw new CategoryDiscountRuleError('INVALID')



  const maxSort = await prisma.categoryDiscountRule.aggregate({ _max: { sortOrder: true } })



  const rule = await prisma.categoryDiscountRule.create({

    data: {

      ...normalized,

      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,

    },

    select: ruleSelect,

  })



  await recalculateAllUnpaidEntryPrices()

  return serializeRule(rule)

}



export async function updateCategoryDiscountRule(

  id: string,

  input: Partial<DiscountRuleInput>,

): Promise<CategoryDiscountRuleRecord> {

  const existing = await prisma.categoryDiscountRule.findUnique({
    where: { id },
    select: { id: true, startsAt: true, endsAt: true },
  })

  if (!existing) throw new CategoryDiscountRuleError('NOT_FOUND')



  const data: {

    label?: string | null

    description?: string | null

    discountPercent?: number

    discipline?: string | null

    experienceLevel?: string | null

    ageDivisionId?: string | null

    enabled?: boolean

    showOnSite?: boolean

    startsAt?: Date | null

    endsAt?: Date | null

  } = {}



  if (input.label !== undefined) data.label = normalizeOptionalText(input.label)

  if (input.description !== undefined) data.description = normalizeOptionalText(input.description)

  if (input.discipline !== undefined) data.discipline = normalizeOptionalId(input.discipline)

  if (input.experienceLevel !== undefined) {

    data.experienceLevel = normalizeOptionalId(input.experienceLevel)

  }

  if (input.ageDivisionId !== undefined) data.ageDivisionId = normalizeOptionalId(input.ageDivisionId)

  if (input.enabled !== undefined) data.enabled = input.enabled

  if (input.showOnSite !== undefined) data.showOnSite = input.showOnSite

  if (input.startsAt !== undefined) data.startsAt = parseScheduleDate(input.startsAt)

  if (input.endsAt !== undefined) data.endsAt = parseScheduleDate(input.endsAt)

  if (input.discountPercent !== undefined) {

    const discountPercent = normalizeDiscountPercent(input.discountPercent)

    if (discountPercent <= 0) throw new CategoryDiscountRuleError('INVALID')

    data.discountPercent = discountPercent

  }



  const nextStartsAt = data.startsAt !== undefined ? data.startsAt : existing.startsAt
  const nextEndsAt = data.endsAt !== undefined ? data.endsAt : existing.endsAt



  if (nextStartsAt && nextEndsAt && nextEndsAt.getTime() < nextStartsAt.getTime()) {

    throw new CategoryDiscountRuleError('INVALID')

  }



  const rule = await prisma.categoryDiscountRule.update({

    where: { id },

    data,

    select: ruleSelect,

  })



  await recalculateAllUnpaidEntryPrices()

  return serializeRule(rule)

}



export async function deleteCategoryDiscountRule(id: string): Promise<void> {

  const existing = await prisma.categoryDiscountRule.findUnique({ where: { id }, select: { id: true } })

  if (!existing) throw new CategoryDiscountRuleError('NOT_FOUND')



  await prisma.categoryDiscountRule.delete({ where: { id } })

  await recalculateAllUnpaidEntryPrices()

}



export async function recalculateUnpaidEntryPricesForRegistration(

  registrationId: string,

  rules?: CategoryDiscountRuleLike[],

): Promise<void> {

  const activeRules = rules ?? await listActiveCategoryDiscountRules()



  const registration = await prisma.teamRegistration.findUnique({

    where: { id: registrationId },

    select: {

      registrationStage: true,

      club: { select: { discountPercent: true } },

      athletes: {

        select: {

          entries: {

            select: {

              id: true,

              discipline: true,

              experienceLevel: true,

              ageDivisionId: true,

              paymentStatus: true,

              price: true,

            },

          },

        },

      },

    },

  })



  if (!registration) return



  const basePrice = getEffectiveBasePriceForUnpaidEntries(registration.registrationStage)

  const clubDiscountPercent = registration.club?.discountPercent

  let hasUnpaid = false

  for (const athlete of registration.athletes) {

    for (const entry of athlete.entries) {

      if (entry.paymentStatus !== 'UNPAID') continue

      hasUnpaid = true

      const nextPrice = resolveEntryPrice(

        basePrice,

        {

          discipline: entry.discipline,

          experienceLevel: entry.experienceLevel,

          ageDivisionId: entry.ageDivisionId,

        },

        activeRules,

        clubDiscountPercent,

      )

      if (nextPrice === entry.price) continue

      await prisma.athleteEntry.update({

        where: { id: entry.id },

        data: { price: nextPrice },

      })

    }

  }

  if (hasUnpaid) {
    await prisma.teamRegistration.update({
      where: { id: registrationId },
      data: {
        pricePerDiscipline: getEffectivePricePerDisciplineForUnpaidEntries(
          registration.registrationStage,
          clubDiscountPercent,
        ),
      },
    })
  }

  await syncRegistrationTotals(registrationId)

}



export async function recalculateAllUnpaidEntryPrices(): Promise<void> {

  const registrations = await prisma.teamRegistration.findMany({

    where: { status: { not: 'CANCELLED' } },

    select: { id: true },

  })



  const rules = await listActiveCategoryDiscountRules()



  for (const registration of registrations) {

    await recalculateUnpaidEntryPricesForRegistration(registration.id, rules)

  }

}


