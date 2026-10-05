import './zodSetup'
import { z } from 'zod'

export const editCodeValueSchema = z
  .string()
  .trim()
  .min(4, 'Минимум 4 символа')
  .max(32, 'Максимум 32 символа')

export const adminSetEditCodeSchema = z.object({
  editCode: editCodeValueSchema,
})
