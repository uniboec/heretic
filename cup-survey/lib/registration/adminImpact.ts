import { withBasePath } from '../basePath'
import { readJsonResponse } from '../http/readJsonResponse'
import { stableJsonHash } from '../brackets/live/mutationFingerprint'
import type { CategoryLockLevel } from '../brackets/live/guard'
import {
  getRegistrationCategoryIdentity,
  getRegistrationCategoryKey,
} from './categoryIdentity'

export type RegistrationImpactPreview = {
  impactToken: string
  affectedCategoryKeys: string[]
  lockLevels: Record<string, CategoryLockLevel>
  totalCategoryCount: number
}

export function requiresRegistrationImpactConfirm(
  lockLevels: Record<string, CategoryLockLevel>,
): boolean {
  return Object.values(lockLevels).some((level) => level !== 'OPEN')
}

export function fingerprintEntryPaymentStatus(input: {
  entryId: string
  paymentStatus: string
  previousStatus: string
}) {
  return stableJsonHash({ kind: 'entry_payment_status', ...input })
}

export function fingerprintRegistrationCancelled(registrationId: string) {
  return stableJsonHash({ kind: 'registration_cancelled', registrationId })
}

export function fingerprintReviewPayment(input: {
  registrationId: string
  action: 'approve' | 'reject'
  entryIds: string[]
}) {
  return stableJsonHash({ kind: 'review_payment', ...input })
}

export function fingerprintConfirmPayment(input: {
  entryId: string
  paymentStageId: string
}) {
  return stableJsonHash({ kind: 'confirm_payment', ...input })
}

export function fingerprintMarkDebt(input: {
  entryId: string
  paymentStageId: string
}) {
  return stableJsonHash({ kind: 'mark_debt', ...input })
}

export function normalizeAthleteMutationBody(body: {
  lastName: string
  firstName: string
  middleName?: string | null
  birthDate: string
  gender: string
  rank?: string | null
  disciplineEntries: Array<{
    discipline: string
    ageDivisionId: string
    weightCategoryId: string
    experienceLevel: string
  }>
}) {
  return {
    lastName: body.lastName.trim(),
    firstName: body.firstName.trim(),
    middleName: body.middleName?.trim() || null,
    birthDate: body.birthDate,
    gender: body.gender,
    rank: body.rank ?? null,
    disciplineEntries: body.disciplineEntries.map((entry) => ({
      discipline: entry.discipline,
      ageDivisionId: entry.ageDivisionId,
      weightCategoryId: entry.weightCategoryId,
      experienceLevel: entry.experienceLevel,
    })),
  }
}

export function fingerprintAthleteCreate(
  registrationId: string,
  body: Parameters<typeof normalizeAthleteMutationBody>[0],
) {
  return stableJsonHash({
    kind: 'athlete_create',
    registrationId,
    body: normalizeAthleteMutationBody(body),
  })
}

export function fingerprintAthleteUpdate(
  athleteId: string,
  registrationId: string,
  body: Parameters<typeof normalizeAthleteMutationBody>[0],
) {
  return stableJsonHash({
    kind: 'athlete_update',
    athleteId,
    registrationId,
    body: normalizeAthleteMutationBody(body),
  })
}

export function fingerprintAthleteDelete(athleteId: string, registrationId: string) {
  return stableJsonHash({ kind: 'athlete_delete', athleteId, registrationId })
}

export function fingerprintStandaloneForceRebuild(categoryKeys: string[]) {
  return stableJsonHash({ categoryKeys: [...categoryKeys].sort() })
}

export function collectCategoryKeysFromAthletePayload(input: {
  gender: string
  disciplineEntries: Array<{
    discipline: string
    experienceLevel: string
    ageDivisionId: string
    weightCategoryId: string
  }>
}): string[] {
  const keys = new Set<string>()
  const athleteLike = { gender: input.gender, entries: input.disciplineEntries }
  for (const entry of input.disciplineEntries) {
    const identity = getRegistrationCategoryIdentity(entry, athleteLike)
    if (identity) {
      keys.add(getRegistrationCategoryKey(identity))
    }
  }
  return [...keys]
}

export async function fetchRegistrationImpactPreview(input: {
  registrationId: string
  mutationFingerprint: string
  categoryKeys?: string[]
  entryIds?: string[]
}): Promise<
  | { ok: true; data: RegistrationImpactPreview }
  | { ok: false; message: string; code?: string }
> {
  const response = await fetch(withBasePath('/api/admin/brackets/impact-preview'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation: 'admin_registration_mutation',
      expectedVersion: 0,
      registrationId: input.registrationId,
      mutationFingerprint: input.mutationFingerprint,
      categoryKeys: input.categoryKeys,
      entryIds: input.entryIds,
    }),
  })

  const result = await readJsonResponse<RegistrationImpactPreview & { ok?: boolean }>(response)
  if (!result.ok) {
    const code =
      result.body && typeof result.body === 'object' && 'code' in result.body
        ? String((result.body as { code?: string }).code)
        : undefined
    return { ok: false, message: result.error, code }
  }

  return {
    ok: true,
    data: {
      impactToken: result.data.impactToken,
      affectedCategoryKeys: result.data.affectedCategoryKeys,
      lockLevels: result.data.lockLevels,
      totalCategoryCount: result.data.totalCategoryCount,
    },
  }
}
