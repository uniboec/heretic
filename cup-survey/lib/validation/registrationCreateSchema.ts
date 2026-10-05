import './zodSetup'
import { z } from 'zod'
import { formatZodIssues } from './formatZodIssues'
import { parseRegistrationContact } from '../registration/contact'
import { registrationBodySchema } from './registrationSchema'

export const registrationCreateSchema = registrationBodySchema.safeExtend({
  editCode: z
    .string()
    .trim()
    .min(4, 'Укажите секретный код (минимум 4 символа)')
    .max(32, 'Секретный код — максимум 32 символа'),
  deviceToken: z.string().uuid('Некорректный идентификатор устройства'),
})

export type RegistrationCreateBody = z.infer<typeof registrationCreateSchema>

export function parseRegistrationCreateBody(
  body: unknown,
): { data: RegistrationCreateBody; errors: null } | { data: null; errors: string[] } {
  const parsed = registrationCreateSchema.safeParse(body)
  if (!parsed.success) {
    return { data: null, errors: formatZodIssues(parsed.error) }
  }
  return { data: parsed.data, errors: null }
}

export const registrationUnlockSchema = z
  .object({
    contact: z.string().trim().min(1, 'Укажите телефон или электронную почту'),
    editCode: z.string().trim().min(4, 'Укажите секретный код').max(32),
    deviceToken: z.string().uuid('Некорректный идентификатор устройства'),
  })
  .superRefine((data, ctx) => {
    if (!parseRegistrationContact(data.contact)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Укажите корректный телефон или электронную почту',
        path: ['contact'],
      })
    }
  })

export const registrationEditAuthSchema = z.object({
  editCode: z.string().trim().min(4, 'Укажите секретный код').max(32),
  deviceToken: z.string().uuid('Некорректный идентификатор устройства'),
})
