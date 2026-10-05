import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'
import { DEFAULT_AGE_COEFFICIENTS } from './constants'
import { normalizeAgeCoefficients } from './settingsValidation'
import type { AthleteRatingSettings } from './types'

const CACHE_TTL_MS = 15_000

const DEFAULT_SETTINGS: Omit<AthleteRatingSettings, 'tournamentScopeId'> = {
  publicEnabled: false,
  publicTopLimit: 10,
  firstPlacePoints: 60,
  secondPlacePoints: 35,
  thirdPlacePoints: 15,
  placeWithoutWinPercent: 20,
  pointsVictoryPoints: 32,
  clearAdvantageVictoryPoints: 36,
  submissionVictoryPoints: 40,
  chokeVictoryPoints: 40,
  injuryVictoryPoints: 20,
  dqVictoryPoints: 10,
  ageCoefficients: { ...DEFAULT_AGE_COEFFICIENTS },
}

const cache = new Map<string, { value: AthleteRatingSettings; expiresAt: number }>()

export function invalidateAthleteRatingSettingsCache(scopeId = TOURNAMENT_SCOPE_ID): void {
  cache.delete(scopeId)
}

function rowToSettings(
  row: {
    tournamentScopeId: string
    publicEnabled: boolean
    publicTopLimit: number
    firstPlacePoints: number
    secondPlacePoints: number
    thirdPlacePoints: number
    placeWithoutWinPercent: number
    pointsVictoryPoints: number
    clearAdvantageVictoryPoints: number
    submissionVictoryPoints: number
    chokeVictoryPoints: number
    injuryVictoryPoints: number
    dqVictoryPoints: number
    ageCoefficients: unknown
  },
): AthleteRatingSettings {
  return {
    tournamentScopeId: row.tournamentScopeId,
    publicEnabled: row.publicEnabled,
    publicTopLimit: row.publicTopLimit,
    firstPlacePoints: row.firstPlacePoints,
    secondPlacePoints: row.secondPlacePoints,
    thirdPlacePoints: row.thirdPlacePoints,
    placeWithoutWinPercent: row.placeWithoutWinPercent,
    pointsVictoryPoints: row.pointsVictoryPoints,
    clearAdvantageVictoryPoints: row.clearAdvantageVictoryPoints,
    submissionVictoryPoints: row.submissionVictoryPoints,
    chokeVictoryPoints: row.chokeVictoryPoints,
    injuryVictoryPoints: row.injuryVictoryPoints,
    dqVictoryPoints: row.dqVictoryPoints,
    ageCoefficients: normalizeAgeCoefficients(row.ageCoefficients),
  }
}

export async function getAthleteRatingSettings(
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<AthleteRatingSettings> {
  const now = Date.now()
  const cached = cache.get(scopeId)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const row = await prisma.athleteRatingSetting.findUnique({
    where: { tournamentScopeId: scopeId },
  })

  const value: AthleteRatingSettings = row
    ? rowToSettings(row)
    : { tournamentScopeId: scopeId, ...DEFAULT_SETTINGS }

  cache.set(scopeId, { value, expiresAt: now + CACHE_TTL_MS })
  return value
}

export type AthleteRatingSettingsUpdateInput = Omit<
  AthleteRatingSettings,
  'tournamentScopeId'
>

export async function updateAthleteRatingSettings(
  input: AthleteRatingSettingsUpdateInput,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<AthleteRatingSettings> {
  const row = await prisma.athleteRatingSetting.upsert({
    where: { tournamentScopeId: scopeId },
    create: {
      tournamentScopeId: scopeId,
      ...input,
      ageCoefficients: input.ageCoefficients,
    },
    update: {
      ...input,
      ageCoefficients: input.ageCoefficients,
    },
  })

  invalidateAthleteRatingSettingsCache(scopeId)
  return rowToSettings(row)
}
