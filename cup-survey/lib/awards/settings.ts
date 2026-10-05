import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'
import { AwardsPageSettingMissingError } from './errors'
import type { AwardsPageSettings } from './types'

const DEFAULT_SETTINGS: Omit<AwardsPageSettings, 'updatedAt'> = {
  tournamentScopeId: TOURNAMENT_SCOPE_ID,
  publicEnabled: false,
  ceremonyStartTime: '11:00',
  ceremonyDurationMinutes: 3,
  ceremonyBreakMinutes: 0,
  queueRevision: 0,
  ceremonySequenceCounter: 0,
}

export async function ensureAwardsPageSettings(
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<AwardsPageSettings> {
  const row = await prisma.awardsPageSetting.upsert({
    where: { tournamentScopeId: scopeId },
    create: { ...DEFAULT_SETTINGS, tournamentScopeId: scopeId },
    update: {},
  })
  return row
}

export async function getAwardsPageSettings(
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<AwardsPageSettings> {
  const settings = await prisma.awardsPageSetting.findUnique({
    where: { tournamentScopeId: scopeId },
  })
  if (!settings) {
    return ensureAwardsPageSettings(scopeId)
  }
  return settings
}

export type AwardsSettingsPatch = {
  publicEnabled?: boolean
  ceremonyStartTime?: string
  ceremonyDurationMinutes?: number
  ceremonyBreakMinutes?: number
}

export async function updateAwardsPageSettings(
  input: AwardsSettingsPatch,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<AwardsPageSettings> {
  await ensureAwardsPageSettings(scopeId)
  return prisma.awardsPageSetting.update({
    where: { tournamentScopeId: scopeId },
    data: {
      ...(input.publicEnabled !== undefined ? { publicEnabled: input.publicEnabled } : {}),
      ...(input.ceremonyStartTime !== undefined
        ? { ceremonyStartTime: input.ceremonyStartTime }
        : {}),
      ...(input.ceremonyDurationMinutes !== undefined
        ? { ceremonyDurationMinutes: input.ceremonyDurationMinutes }
        : {}),
      ...(input.ceremonyBreakMinutes !== undefined
        ? { ceremonyBreakMinutes: input.ceremonyBreakMinutes }
        : {}),
    },
  })
}
