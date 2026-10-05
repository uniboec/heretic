import { z } from 'zod'

export const NormQualificationSettingsPatchSchema = z
  .object({
    publicEnabled: z.boolean().optional(),
  })
  .strict()
