import './zodSetup'
import { z } from 'zod'
import { disciplineIds } from '../config/tournament'
import { experienceLevelOptions } from '../config/experienceLevel'
import { fseAgeDivisions } from '../config/fseCategories'

const experienceLevelIds = experienceLevelOptions.map((option) => option.id)
const ageDivisionIds = fseAgeDivisions.map((division) => division.id)

const optionalEnum = <T extends string>(values: readonly T[]) =>
  z
    .union([z.literal(''), z.enum(values as [T, ...T[]])])
    .transform((value) => (value === '' ? null : value))

const optionalDateTime = z
  .union([z.string().datetime(), z.literal(''), z.null()])
  .transform((value) => (value === '' || value === null ? null : value))

const discountRuleFieldsSchema = z.object({
  label: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  discountPercent: z.coerce.number().int().min(1).max(100),
  discipline: optionalEnum(disciplineIds),
  experienceLevel: optionalEnum(experienceLevelIds),
  ageDivisionId: optionalEnum(ageDivisionIds),
  enabled: z.boolean().optional(),
  showOnSite: z.boolean().optional(),
  startsAt: optionalDateTime,
  endsAt: optionalDateTime,
})

function refineDiscountSchedule<T extends { startsAt?: string | null; endsAt?: string | null }>(
  schema: z.ZodType<T>,
) {
  return schema.superRefine((value, ctx) => {
    if (value.startsAt && value.endsAt && new Date(value.endsAt) < new Date(value.startsAt)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Дата окончания не может быть раньше даты начала.',
        path: ['endsAt'],
      })
    }
  })
}

export const discountRuleBodySchema = refineDiscountSchedule(discountRuleFieldsSchema)

export const discountRuleUpdateBodySchema = refineDiscountSchedule(
  discountRuleFieldsSchema.partial(),
).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Нужно указать хотя бы одно поле для изменения.' },
)
