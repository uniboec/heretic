import './zodSetup'
import { z } from 'zod'
import { formatZodIssues } from './formatZodIssues'
import { getAwardPackageById } from '../config/award-packages'
import { beltIds } from '../config/belts'
import { cupIds } from '../config/cups'
import { disciplineIds } from '../config/disciplines'
import { dayFormatIds, priorityIds, roleIds } from '../config/enums'
import { medalIds } from '../config/medals'
import { prizeCompositionIds, compositionNeedsBelts, compositionNeedsCups } from '../config/prize-compositions'
import { venueIds } from '../config/venues'
import { normalizePhoneToE164 } from '../phone'
import { syncPrimaryChoice } from '../primarySelection'

const nonEmptyArray = (field: string) =>
  z.array(z.string()).min(1, `Выберите хотя бы один вариант: ${field}`)

export const surveyBodySchema = z
  .object({
    submissionId: z.string().uuid(),
    representativeName: z.string().trim().min(2, 'Укажите ФИО представителя'),
    roles: z
      .array(z.enum(roleIds as [string, ...string[]]))
      .min(1, 'Выберите роль')
      .max(1, 'Выберите одну роль'),
    rolesOther: z.string().trim().optional(),
    organizationName: z.string().trim().min(2, 'Укажите название клуба / команды'),
    city: z.string().trim().min(2, 'Укажите город'),
    phone: z.string().trim().min(5, 'Укажите контактный телефон'),
    athletesCount: z.number().int().min(1).optional().nullable(),
    disciplines: z
      .array(z.enum(disciplineIds as [string, ...string[]]))
      .min(1, 'Выберите хотя бы одну дисциплину'),
    acceptableVenues: nonEmptyArray('площадки'),
    preferredVenue: z.string(),
    dayFormatPreference: z.enum(dayFormatIds as [string, ...string[]]),
    acceptableMedals: nonEmptyArray('медали'),
    preferredMedal: z.string(),
    acceptablePrizeCompositions: z
      .array(z.enum(prizeCompositionIds as [string, ...string[]]))
      .min(1, 'Выберите состав призов в категориях'),
    acceptableBelts: z.array(z.enum(beltIds as [string, ...string[]])),
    preferredBelt: z.string(),
    acceptableCups: z.array(z.enum(cupIds as [string, ...string[]])),
    preferredCup: z.string(),
    acceptableAwardPackages: nonEmptyArray('наградные пакеты'),
    priorities: z.array(z.enum(priorityIds as [string, ...string[]])).max(3, 'Можно выбрать не более 3 приоритетов'),
    prioritiesOther: z.string().trim().optional(),
    comment: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.roles.includes('other') && !data.rolesOther?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Укажите роль в поле «Другое»', path: ['rolesOther'] })
    }
    if (data.priorities.includes('other') && !data.prioritiesOther?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Укажите приоритет в поле «Другое»', path: ['prioritiesOther'] })
    }
    const venuePrimary = syncPrimaryChoice(data.acceptableVenues, data.preferredVenue)
    if (!venuePrimary || !venueIds.includes(venuePrimary as (typeof venueIds)[number])) {
      ctx.addIssue({
        code: 'custom',
        message: 'Основная площадка должна быть среди приемлемых',
        path: ['preferredVenue'],
      })
    } else if (data.acceptableVenues.length > 1 && !data.preferredVenue) {
      ctx.addIssue({
        code: 'custom',
        message: 'Выберите основную площадку',
        path: ['preferredVenue'],
      })
    }

    const medalPrimary = syncPrimaryChoice(data.acceptableMedals, data.preferredMedal)
    if (!medalPrimary || !data.acceptableMedals.includes(medalPrimary)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Основной вариант медалей должен быть среди выбранных',
        path: ['preferredMedal'],
      })
    } else if (data.acceptableMedals.length > 1 && !data.preferredMedal) {
      ctx.addIssue({
        code: 'custom',
        message: 'Выберите основной вариант медалей',
        path: ['preferredMedal'],
      })
    }

    if (compositionNeedsBelts(data.acceptablePrizeCompositions)) {
      const beltChoices = data.acceptableBelts.filter((id) => id !== 'none')
      if (!beltChoices.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'Выберите варианты поясов',
          path: ['acceptableBelts'],
        })
      } else {
        const beltPrimary = syncPrimaryChoice(beltChoices, data.preferredBelt)
        if (!beltPrimary || !beltChoices.includes(beltPrimary)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Основной вариант поясов должен быть среди выбранных',
            path: ['preferredBelt'],
          })
        } else if (beltChoices.length > 1 && !data.preferredBelt) {
          ctx.addIssue({
            code: 'custom',
            message: 'Выберите основной вариант поясов',
            path: ['preferredBelt'],
          })
        }
      }
    }

    if (compositionNeedsCups(data.acceptablePrizeCompositions)) {
      const cupChoices = data.acceptableCups.filter((id) => id !== 'none')
      if (!cupChoices.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'Выберите варианты кубков',
          path: ['acceptableCups'],
        })
      } else {
        const cupPrimary = syncPrimaryChoice(cupChoices, data.preferredCup)
        if (!cupPrimary || !cupChoices.includes(cupPrimary)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Основной вариант кубков должен быть среди выбранных',
            path: ['preferredCup'],
          })
        } else if (cupChoices.length > 1 && !data.preferredCup) {
          ctx.addIssue({
            code: 'custom',
            message: 'Выберите основной вариант кубков',
            path: ['preferredCup'],
          })
        }
      }
    }

    for (const packageId of data.acceptableAwardPackages) {
      const pkg = getAwardPackageById(packageId)
      if (!pkg) {
        ctx.addIssue({ code: 'custom', message: `Неизвестный пакет: ${packageId}`, path: ['acceptableAwardPackages'] })
        continue
      }
      if (!data.acceptableMedals.includes(pkg.medalId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Пакет ${packageId} не согласован с выбранными медалями`,
          path: ['acceptableAwardPackages'],
        })
      }
      if (!data.acceptablePrizeCompositions.includes(pkg.compositionId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Пакет ${packageId} не согласован с комплектацией призов`,
          path: ['acceptableAwardPackages'],
        })
      }
      if (pkg.beltId !== 'none') {
        if (!data.acceptableBelts.includes(pkg.beltId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Пакет ${packageId} не согласован с выбранными поясами`,
            path: ['acceptableAwardPackages'],
          })
        }
      } else if (compositionNeedsBelts([pkg.compositionId])) {
        ctx.addIssue({
          code: 'custom',
          message: `Пакет ${packageId} не согласован с выбранными поясами`,
          path: ['acceptableAwardPackages'],
        })
      }
      if (pkg.cupId !== 'none') {
        if (!data.acceptableCups.includes(pkg.cupId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Пакет ${packageId} не согласован с выбранными кубками`,
            path: ['acceptableAwardPackages'],
          })
        }
      } else if (compositionNeedsCups([pkg.compositionId])) {
        ctx.addIssue({
          code: 'custom',
          message: `Пакет ${packageId} не согласован с выбранными кубками`,
          path: ['acceptableAwardPackages'],
        })
      }
    }
    const e164 = normalizePhoneToE164(data.phone)
    if (!e164) {
      ctx.addIssue({ code: 'custom', message: 'Некорректный номер телефона', path: ['phone'] })
    }
  })

export type SurveyBody = z.infer<typeof surveyBodySchema>

export function parseSurveyBody(body: unknown): { data: SurveyBody & { phone: string }; errors: null } | { data: null; errors: string[] } {
  const parsed = surveyBodySchema.safeParse(body)
  if (!parsed.success) {
    return { data: null, errors: formatZodIssues(parsed.error) }
  }
  const e164 = normalizePhoneToE164(parsed.data.phone)
  if (!e164) {
    return { data: null, errors: ['Некорректный номер телефона'] }
  }
  return { data: { ...parsed.data, phone: e164 }, errors: null }
}

export function getPayloadForHash(data: SurveyBody): Record<string, unknown> {
  const { submissionId: _, ...rest } = data
  return rest as Record<string, unknown>
}

// Re-export for validation of enum arrays
export { beltIds, medalIds, venueIds }
