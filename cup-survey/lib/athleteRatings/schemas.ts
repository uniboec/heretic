import { z } from 'zod'
import { ATHLETE_RATING_AGE_BRACKET_KEYS } from './constants'

const ageCoefficientsSchema = z.object(
  Object.fromEntries(
    ATHLETE_RATING_AGE_BRACKET_KEYS.map((key) => [
      key,
      z.number().int().positive(),
    ]),
  ) as Record<(typeof ATHLETE_RATING_AGE_BRACKET_KEYS)[number], z.ZodNumber>,
)

export const AthleteRatingSettingsPatchSchema = z.object({
  publicEnabled: z.boolean(),
  publicTopLimit: z.number().int().positive(),
  firstPlacePoints: z.number().int().min(0),
  secondPlacePoints: z.number().int().min(0),
  thirdPlacePoints: z.number().int().min(0),
  placeWithoutWinPercent: z.number().int().min(0).max(100),
  pointsVictoryPoints: z.number().int().min(0),
  clearAdvantageVictoryPoints: z.number().int().min(0),
  submissionVictoryPoints: z.number().int().min(0),
  chokeVictoryPoints: z.number().int().min(0),
  injuryVictoryPoints: z.number().int().min(0),
  dqVictoryPoints: z.number().int().min(0),
  ageCoefficients: ageCoefficientsSchema,
})

export const AthleteRatingViewSchema = z.enum([
  'overall',
  'tactic_control',
  'close_control',
])
