import {
  getRegistrationCategoryIdentity,
  getRegistrationCategoryKey,
  type CategoryIdentityEntry,
} from './categoryIdentity'
import { randomUUID } from 'crypto'
import { prisma } from '../prisma'

type AthleteLike = {
  gender: string
  entries: CategoryIdentityEntry[]
}

export function collectCategoryKeysFromAthletes(athletes: AthleteLike[]): string[] {
  const keys = new Set<string>()
  for (const athlete of athletes) {
    for (const entry of athlete.entries) {
      const identity = getRegistrationCategoryIdentity(entry, athlete)
      if (identity) {
        keys.add(getRegistrationCategoryKey(identity))
      }
    }
  }
  return [...keys]
}

export async function loadCategoryKeysForRegistration(registrationId: string): Promise<string[]> {
  const registration = await prisma.teamRegistration.findUnique({
    where: { id: registrationId },
    include: { athletes: { include: { entries: true } } },
  })
  if (!registration) return []
  return collectCategoryKeysFromAthletes(registration.athletes)
}

export async function loadCategoryKeysForEntry(entryId: string): Promise<string[]> {
  const { loadCategoryKeysForEntryIds } = await import('../brackets/live/impact')
  return prisma.$transaction((tx) => loadCategoryKeysForEntryIds(tx, [entryId]))
}

export function collectCategoryKeysFromRegistrationBody(
  athletes: Array<{
    gender: string
    disciplineEntries: Array<{
      discipline: string
      experienceLevel: string
      ageDivisionId: string
      weightCategoryId: string
    }>
  }>,
): string[] {
  return collectCategoryKeysFromAthletes(
    athletes.map((athlete) => ({
      gender: athlete.gender,
      entries: athlete.disciplineEntries,
    })),
  )
}

/** Full registration sync into bracket working generation. Safe no-op without generation. */
export async function autoSyncBracketDraftForRegistrationChange(
  categoryKeys?: string[],
): Promise<void> {
  const operationId = randomUUID()
  try {
    const { resolveWorkingDraftGeneration } = await import('../brackets/live/generation')
    const { autoSyncCategoryKeysForRegistrationChange } = await import('../brackets/live/policyD')
    const draft = await resolveWorkingDraftGeneration()
    if (!draft) return

    let targetKeys = categoryKeys
    if (targetKeys?.length) {
      const pubStates = await prisma.bracketPublicationState.findMany({
        where: { categoryKey: { in: targetKeys } },
      })
      targetKeys = autoSyncCategoryKeysForRegistrationChange(targetKeys, pubStates)
      if (targetKeys.length === 0) return
    }

    const { syncBracketDraft } = await import('../brackets/generation/sync')
    await syncBracketDraft({
      draftId: draft.id,
      expectedVersion: draft.version,
      scope: 'all',
      categoryKeys: targetKeys,
      afterRegistrationChange: true,
      operationId,
    })
  } catch (error) {
    const { resolveWorkingDraftGeneration } = await import('../brackets/live/generation')
    const draft = await resolveWorkingDraftGeneration()
    if (draft) {
      const { recordAutoSyncFailure } = await import('../brackets/generation/autoSyncEvents')
      const regState = await prisma.tournamentRegistrationState.findUnique({ where: { id: 'default' } })
      await recordAutoSyncFailure({
        operationId,
        generationId: draft.id,
        categoryKeys: [],
        revision: regState?.revision,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }
    console.error('autoSyncBracketDraftForRegistrationChange failed', error)
  }
}
