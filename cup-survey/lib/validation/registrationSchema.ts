import './zodSetup'
import { z } from 'zod'
import { formatZodIssues } from './formatZodIssues'
import { sportRankIds } from '../config/ranks'
import { disciplineIds, genderOptions } from '../config/tournament'
import { athleteCategorySelectionKey, validateCategorySelection } from '../registration/categoryRules'
import { validateRankForBirthDate } from '../registration/rankRules'
import { isExperienceLevelAllowed } from '../config/experienceLevel'
import { normalizePhoneToE164 } from '../phone'
import { isValidEmail } from '../email'

const disciplineEntrySchema = z.object({
  entryId: z.string().uuid().optional(),
  discipline: z.enum(disciplineIds as [string, ...string[]], { message: 'Выберите дисциплину' }),
  ageDivisionId: z.string().min(1, 'Выберите возрастную категорию'),
  weightCategoryId: z.string().min(1, 'Выберите весовую категорию'),
  experienceLevel: z.enum(['novice', 'experienced'], { message: 'Выберите уровень подготовки' }),
})

const athleteSchema = z
  .object({
    athleteId: z.string().uuid().optional(),
    lastName: z.string().trim().min(2, 'Укажите фамилию'),
    firstName: z.string().trim().min(2, 'Укажите имя'),
    middleName: z.string().trim().optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Укажите дату рождения'),
    gender: z.enum(genderOptions.map((g) => g.id) as [string, ...string[]], { message: 'Выберите пол' }),
    rank: z.enum(sportRankIds as [string, ...string[]], { message: 'Выберите разряд' }),
    disciplineEntries: z.array(disciplineEntrySchema).min(1, 'Добавьте хотя бы одну категорию'),
  })
  .superRefine((athlete, ctx) => {
    if (athlete.middleName && athlete.middleName.length < 2) {
      ctx.addIssue({
        code: 'custom',
        message: 'Укажите отчество полностью или оставьте поле пустым',
        path: ['middleName'],
      })
    }

    const rankError = validateRankForBirthDate(athlete.rank, athlete.birthDate)
    if (rankError) {
      ctx.addIssue({
        code: 'custom',
        message: rankError,
        path: ['rank'],
      })
    }

    const keys = new Set<string>()

    for (const [index, entry] of athlete.disciplineEntries.entries()) {
      const categoryError = validateCategorySelection({
        birthDate: athlete.birthDate,
        gender: athlete.gender as 'male' | 'female',
        ageDivisionId: entry.ageDivisionId,
        weightCategoryId: entry.weightCategoryId,
      })
      if (categoryError) {
        ctx.addIssue({
          code: 'custom',
          message: categoryError,
          path: ['disciplineEntries', index],
        })
      }

      if (!isExperienceLevelAllowed(athlete.rank, entry.experienceLevel)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Для вашего разряда доступна только группа «Опытные»',
          path: ['disciplineEntries', index, 'experienceLevel'],
        })
      }

      const key = athleteCategorySelectionKey(entry)
      if (keys.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Такая категория уже добавлена',
          path: ['disciplineEntries', index],
        })
      }
      keys.add(key)
    }
  })

export const registrationBodySchema = z
  .object({
    clubId: z.string().uuid('Некорректный идентификатор клуба').optional(),
    clubName: z.string().trim().min(2, 'Укажите название клуба').optional(),
    city: z.string().trim().min(2, 'Укажите город').optional(),
    phone: z.string().trim().min(5, 'Укажите телефон'),
    email: z.string().trim(),
    athletes: z.array(athleteSchema).min(1, 'Добавьте хотя бы одного спортсмена'),
    consentPersonalData: z.boolean().refine((v) => v, {
      message: 'Необходимо согласие на обработку персональных данных',
    }),
    consentPublication: z.boolean().refine((v) => v, {
      message: 'Необходимо согласие на публикацию в списке участников',
    }),
  })
  .superRefine((data, ctx) => {
    const e164 = normalizePhoneToE164(data.phone)
    if (!e164) {
      ctx.addIssue({ code: 'custom', message: 'Некорректный номер телефона', path: ['phone'] })
    }

    if (data.email && !isValidEmail(data.email)) {
      ctx.addIssue({ code: 'custom', message: 'Некорректный адрес электронной почты', path: ['email'] })
    }

    if (data.clubId) return

    if (!data.clubName) {
      ctx.addIssue({ code: 'custom', message: 'Укажите название клуба', path: ['clubName'] })
    }
    if (!data.city) {
      ctx.addIssue({ code: 'custom', message: 'Укажите город клуба', path: ['city'] })
    }
  })

const standaloneAthleteSchema = athleteSchema
  .extend({
    clubName: z.string().trim().min(2, 'Укажите название клуба'),
    city: z.string().trim().min(2, 'Укажите город'),
    phone: z.string().trim().min(5, 'Укажите телефон'),
  })
  .superRefine((data, ctx) => {
    const e164 = normalizePhoneToE164(data.phone)
    if (!e164) {
      ctx.addIssue({ code: 'custom', message: 'Некорректный номер телефона', path: ['phone'] })
    }
  })

export type RegistrationBody = z.infer<typeof registrationBodySchema>
export type DisciplineEntryBody = z.infer<typeof disciplineEntrySchema>
export type AthleteBody = z.infer<typeof athleteSchema>
export type StandaloneAthleteBody = z.infer<typeof standaloneAthleteSchema>

export function parseAthleteBody(
  body: unknown,
): { data: AthleteBody; errors: null } | { data: null; errors: string[] } {
  const parsed = athleteSchema.safeParse(body)
  if (!parsed.success) {
    return { data: null, errors: formatZodIssues(parsed.error) }
  }
  return { data: parsed.data, errors: null }
}

export function parseStandaloneAthleteBody(
  body: unknown,
): { data: StandaloneAthleteBody; errors: null } | { data: null; errors: string[] } {
  const parsed = standaloneAthleteSchema.safeParse(body)
  if (!parsed.success) {
    return { data: null, errors: formatZodIssues(parsed.error) }
  }
  return { data: parsed.data, errors: null }
}

export function parseRegistrationBody(body: unknown): { data: RegistrationBody; errors: null } | { data: null; errors: string[] } {
  const parsed = registrationBodySchema.safeParse(body)
  if (!parsed.success) {
    return { data: null, errors: formatZodIssues(parsed.error) }
  }
  return { data: parsed.data, errors: null }
}
