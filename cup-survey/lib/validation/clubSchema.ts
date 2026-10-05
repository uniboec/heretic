import './zodSetup'
import { z } from 'zod'
import { formatZodIssues } from './formatZodIssues'

const clubUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Укажите название клуба'),
  city: z.string().trim().min(2, 'Укажите город'),
  discountPercent: z
    .union([
      z.number().int('Скидка должна быть целым числом').min(0, 'Скидка не может быть меньше 0').max(100, 'Скидка не может быть больше 100'),
      z.null(),
    ])
    .optional(),
})

export function parseClubUpdateBody(body: unknown) {
  const result = clubUpdateSchema.safeParse(body)
  if (result.success) {
    return { data: result.data, errors: null }
  }

  return {
    data: null,
    errors: formatZodIssues(result.error),
  }
}
