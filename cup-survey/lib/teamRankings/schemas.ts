import { z } from 'zod'

export const TeamRankingSettingsPatchSchema = z
  .object({
    firstPlacePoints: z.number().int().min(0),
    secondPlacePoints: z.number().int().min(0),
    thirdPlacePoints: z.number().int().min(0),
    soloParticipantPointsMode: z.enum(['STANDARD', 'EXCLUDE', 'CUSTOM']),
    soloParticipantFirstPlacePoints: z.number().int().min(0).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.soloParticipantPointsMode === 'CUSTOM') {
      if (
        value.soloParticipantFirstPlacePoints == null ||
        value.soloParticipantFirstPlacePoints < 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'soloParticipantFirstPlacePoints is required when mode is CUSTOM',
          path: ['soloParticipantFirstPlacePoints'],
        })
      }
    }
  })

export type TeamRankingSettingsPatchInput = z.infer<typeof TeamRankingSettingsPatchSchema>
