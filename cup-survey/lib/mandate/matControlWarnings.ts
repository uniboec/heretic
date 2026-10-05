import { prisma } from '@/lib/prisma'
import { withTransientDbRetry } from '@/lib/prisma/transientDbRetry'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import type { EntryPaymentStatus } from '@/lib/registration/status'
import {
  getAthleteBracketCategoryKeys,
  loadMandateChecksByAthleteIds,
  loadPublishedBracketEntryIds,
} from './adminMandateList'
import { buildEntryVerificationWarningsMap } from './verificationWarnings'
import type { MandateWarning } from './types'

export type MatControlEntryMandateContext = {
  entryWarnings: Record<string, MandateWarning[]>
  entryAthleteIds: Record<string, string>
}

export function collectBoutEntryRefs(
  bout: import('../bouts/types').InternalBout,
): Array<{ entryId: string; categoryKey: string }> {
  const refs: Array<{ entryId: string; categoryKey: string }> = []
  if (bout.sideA.kind === 'athlete') {
    refs.push({ entryId: bout.sideA.entryId, categoryKey: bout.categoryKey })
  }
  if (bout.sideB.kind === 'athlete') {
    refs.push({ entryId: bout.sideB.entryId, categoryKey: bout.categoryKey })
  }
  return refs
}

export async function loadMatControlEntryWarnings(
  boutEntries: Array<{ entryId: string; categoryKey: string }>,
): Promise<MatControlEntryMandateContext> {
  return withTransientDbRetry(() => loadMatControlEntryWarningsOnce(boutEntries))
}

async function loadMatControlEntryWarningsOnce(
  boutEntries: Array<{ entryId: string; categoryKey: string }>,
): Promise<MatControlEntryMandateContext> {
  if (boutEntries.length === 0) {
    return { entryWarnings: {}, entryAthleteIds: {} }
  }

  const uniqueEntryIds = [...new Set(boutEntries.map((row) => row.entryId))]
  const entryRows = await prisma.athleteEntry.findMany({
    where: { id: { in: uniqueEntryIds } },
    select: {
      id: true,
      athleteId: true,
      paymentStatus: true,
    },
  })

  const athleteIds = [...new Set(entryRows.map((row) => row.athleteId))]
  const checksByAthleteId = await loadMandateChecksByAthleteIds(athleteIds)

  const athleteCategoryKeys = new Map<string, string[]>()
  await Promise.all(
    athleteIds.map(async (athleteId) => {
      athleteCategoryKeys.set(athleteId, await getAthleteBracketCategoryKeys(athleteId))
    }),
  )

  const entryById = new Map(entryRows.map((row) => [row.id, row]))
  const categoryKeyByEntryId = new Map(boutEntries.map((row) => [row.entryId, row.categoryKey]))

  const payload = uniqueEntryIds
    .map((entryId) => {
      const entry = entryById.get(entryId)
      if (!entry) return null
      return {
        entryId,
        categoryKey: categoryKeyByEntryId.get(entryId) ?? '',
        paymentStatus: entry.paymentStatus as EntryPaymentStatus,
        athleteId: entry.athleteId,
        athleteCategoryKeys: athleteCategoryKeys.get(entry.athleteId) ?? [],
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  const entryAthleteIds: Record<string, string> = {}
  for (const row of payload) {
    entryAthleteIds[row.entryId] = row.athleteId
  }

  return {
    entryWarnings: buildEntryVerificationWarningsMap(payload, checksByAthleteId),
    entryAthleteIds,
  }
}

export async function loadHasWeighInByAthleteIds(
  athleteIds: string[],
): Promise<Map<string, boolean>> {
  if (athleteIds.length === 0) return new Map()

  const checks = await prisma.athleteMandateCheck.findMany({
    where: {
      tournamentScopeId: TOURNAMENT_SCOPE_ID,
      athleteId: { in: athleteIds },
    },
  })

  const checkByAthlete = new Map(checks.map((row) => [row.athleteId, row]))
  const result = new Map<string, boolean>()

  await Promise.all(
    athleteIds.map(async (athleteId) => {
      const checkRow = checkByAthlete.get(athleteId)
      if (!checkRow) {
        result.set(athleteId, false)
        return
      }
      const { computeWeightStatus } = await import('./computeWeightStatus')
      const categoryKeys = await getAthleteBracketCategoryKeys(athleteId)
      const { serializeMandateCheckRecord } = await import('./patchMandateCheck')
      const check = serializeMandateCheckRecord(checkRow)
      result.set(
        athleteId,
        computeWeightStatus({ check, categoryKeys }).hasWeighIn,
      )
    }),
  )

  return result
}
