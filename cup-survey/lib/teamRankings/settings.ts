import type { SoloParticipantPointsMode } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'
import type { TeamRankingPointSettings, TeamRankingSettings } from './types'

const CACHE_TTL_MS = 15_000

const DEFAULT_SETTINGS: TeamRankingSettings = {
  tournamentScopeId: TOURNAMENT_SCOPE_ID,
  firstPlacePoints: 5,
  secondPlacePoints: 3,
  thirdPlacePoints: 2,
  soloParticipantPointsMode: 'STANDARD',
  soloParticipantFirstPlacePoints: null,
}

const cache = new Map<string, { value: TeamRankingSettings; expiresAt: number }>()

export function invalidateTeamRankingSettingsCache(scopeId = TOURNAMENT_SCOPE_ID): void {
  cache.delete(scopeId)
}

export function toTeamRankingPointSettings(settings: TeamRankingSettings): TeamRankingPointSettings {
  return {
    first: settings.firstPlacePoints,
    second: settings.secondPlacePoints,
    third: settings.thirdPlacePoints,
    soloParticipant: {
      mode: settings.soloParticipantPointsMode,
      points:
        settings.soloParticipantPointsMode === 'CUSTOM'
          ? settings.soloParticipantFirstPlacePoints
          : null,
    },
  }
}

export async function getTeamRankingSettings(
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<TeamRankingSettings> {
  const now = Date.now()
  const cached = cache.get(scopeId)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const row = await prisma.teamRankingSetting.findUnique({
    where: { tournamentScopeId: scopeId },
  })

  const value: TeamRankingSettings = row
    ? {
        tournamentScopeId: row.tournamentScopeId,
        firstPlacePoints: row.firstPlacePoints,
        secondPlacePoints: row.secondPlacePoints,
        thirdPlacePoints: row.thirdPlacePoints,
        soloParticipantPointsMode: row.soloParticipantPointsMode,
        soloParticipantFirstPlacePoints: row.soloParticipantFirstPlacePoints,
      }
    : { ...DEFAULT_SETTINGS, tournamentScopeId: scopeId }

  cache.set(scopeId, { value, expiresAt: now + CACHE_TTL_MS })
  return value
}

export type TeamRankingSettingsUpdateInput = {
  firstPlacePoints: number
  secondPlacePoints: number
  thirdPlacePoints: number
  soloParticipantPointsMode: SoloParticipantPointsMode
  soloParticipantFirstPlacePoints: number | null
}

export async function updateTeamRankingSettings(
  input: TeamRankingSettingsUpdateInput,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<TeamRankingSettings> {
  const row = await prisma.teamRankingSetting.upsert({
    where: { tournamentScopeId: scopeId },
    create: {
      tournamentScopeId: scopeId,
      firstPlacePoints: input.firstPlacePoints,
      secondPlacePoints: input.secondPlacePoints,
      thirdPlacePoints: input.thirdPlacePoints,
      soloParticipantPointsMode: input.soloParticipantPointsMode,
      soloParticipantFirstPlacePoints: input.soloParticipantFirstPlacePoints,
    },
    update: {
      firstPlacePoints: input.firstPlacePoints,
      secondPlacePoints: input.secondPlacePoints,
      thirdPlacePoints: input.thirdPlacePoints,
      soloParticipantPointsMode: input.soloParticipantPointsMode,
      soloParticipantFirstPlacePoints: input.soloParticipantFirstPlacePoints,
    },
  })

  invalidateTeamRankingSettingsCache(scopeId)

  return {
    tournamentScopeId: row.tournamentScopeId,
    firstPlacePoints: row.firstPlacePoints,
    secondPlacePoints: row.secondPlacePoints,
    thirdPlacePoints: row.thirdPlacePoints,
    soloParticipantPointsMode: row.soloParticipantPointsMode,
    soloParticipantFirstPlacePoints: row.soloParticipantFirstPlacePoints,
  }
}
