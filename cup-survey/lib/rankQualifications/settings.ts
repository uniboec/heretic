import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'

export interface NormQualificationSettings {
  tournamentScopeId: string
  evskEventLevel: string
  publicEnabled: boolean
  calculatedAt: string | null
}

export async function getNormQualificationSettings(
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<NormQualificationSettings> {
  const row = await prisma.rankQualificationSetting.findUnique({
    where: { tournamentScopeId: scopeId },
  })

  if (!row) {
    return {
      tournamentScopeId: scopeId,
      evskEventLevel: 'regional_cup',
      publicEnabled: true,
      calculatedAt: null,
    }
  }

  return {
    tournamentScopeId: row.tournamentScopeId,
    evskEventLevel: row.evskEventLevel,
    publicEnabled: row.publicEnabled,
    calculatedAt: row.calculatedAt?.toISOString() ?? null,
  }
}

export async function updateNormQualificationSettings(
  patch: Partial<Pick<NormQualificationSettings, 'publicEnabled'>>,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<NormQualificationSettings> {
  const row = await prisma.rankQualificationSetting.upsert({
    where: { tournamentScopeId: scopeId },
    create: {
      tournamentScopeId: scopeId,
      publicEnabled: patch.publicEnabled ?? true,
    },
    update: {
      ...(patch.publicEnabled !== undefined ? { publicEnabled: patch.publicEnabled } : {}),
    },
  })

  return {
    tournamentScopeId: row.tournamentScopeId,
    evskEventLevel: row.evskEventLevel,
    publicEnabled: row.publicEnabled,
    calculatedAt: row.calculatedAt?.toISOString() ?? null,
  }
}

export async function hasNormQualificationData(scopeId = TOURNAMENT_SCOPE_ID): Promise<boolean> {
  const count = await prisma.rankQualificationResult.count({
    where: {
      tournamentScopeId: scopeId,
      achievedNormRank: { not: null },
    },
  })
  return count > 0
}
