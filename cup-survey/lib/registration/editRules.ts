import type { DisciplineEntryBody, RegistrationBody } from '../validation/registrationSchema'
import { entryCategoryKey } from './entryPayment'
import { getTournamentCategoryLabel } from './categoryRules'
import type { EntryPaymentStatus } from './status'
import { getEntryPaymentStatusLabel, isEntryEligibleForParticipation } from './status'
import { formatAthleteFullName } from './athleteName'

export class RegistrationEditError extends Error {
  readonly code = 'EDIT_VALIDATION'

  constructor(public readonly messages: string[]) {
    super(messages[0] ?? 'EDIT_VALIDATION')
  }
}

export function isLockedEntryStatus(status: EntryPaymentStatus): boolean {
  return status === 'PAYMENT_REVIEW' || isEntryEligibleForParticipation(status)
}

type ExistingEntry = {
  id: string
  discipline: string
  ageDivisionId: string | null
  weightCategoryId: string | null
  experienceLevel: string
  paymentStatus: string
}

type ExistingAthlete = {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  birthDate: Date
  gender: string
  entries: ExistingEntry[]
}

function entryBodyKey(entry: DisciplineEntryBody): string {
  return entryCategoryKey({
    discipline: entry.discipline,
    ageDivisionId: entry.ageDivisionId,
    weightCategoryId: entry.weightCategoryId,
    experienceLevel: entry.experienceLevel,
  })
}

function existingEntryKey(entry: ExistingEntry): string | null {
  if (!entry.ageDivisionId || !entry.weightCategoryId) return null
  return entryCategoryKey({
    discipline: entry.discipline,
    ageDivisionId: entry.ageDivisionId,
    weightCategoryId: entry.weightCategoryId,
    experienceLevel: entry.experienceLevel,
  })
}

function categoryLabel(entry: ExistingEntry): string {
  if (!entry.ageDivisionId || !entry.weightCategoryId) return 'категория'
  return getTournamentCategoryLabel(
    entry.ageDivisionId,
    entry.weightCategoryId,
    entry.experienceLevel as 'novice' | 'experienced',
  )
}

function formatBirthDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function validateRegistrationEdit(
  existingAthletes: ExistingAthlete[],
  body: RegistrationBody,
): void {
  const errors: string[] = []
  const submittedByAthleteId = new Map(
    body.athletes.filter((athlete) => athlete.athleteId).map((athlete) => [athlete.athleteId!, athlete]),
  )
  const existingById = new Map(existingAthletes.map((athlete) => [athlete.id, athlete]))

  for (const existingAthlete of existingAthletes) {
    const submitted = submittedByAthleteId.get(existingAthlete.id)
    const lockedEntries = existingAthlete.entries.filter((entry) =>
      isLockedEntryStatus(entry.paymentStatus as EntryPaymentStatus),
    )
    const athleteName = formatAthleteFullName(existingAthlete)

    if (lockedEntries.length > 0 && !submitted) {
      errors.push(`Нельзя удалить спортсмена ${athleteName}: есть оплаченные или проверяемые категории.`)
      continue
    }

    if (!submitted) continue

    if (lockedEntries.length > 0) {
      if (submitted.birthDate !== formatBirthDate(existingAthlete.birthDate)) {
        errors.push(
          `Нельзя менять дату рождения у ${athleteName}: есть оплаченные или проверяемые категории.`,
        )
      }
      if (submitted.gender !== existingAthlete.gender) {
        errors.push(`Нельзя менять пол у ${athleteName}: есть оплаченные или проверяемые категории.`)
      }
    }

    const submittedEntries = submitted.disciplineEntries
    const submittedEntryIds = new Set(
      submittedEntries.filter((entry) => entry.entryId).map((entry) => entry.entryId!),
    )

    for (const lockedEntry of lockedEntries) {
      const lockedKey = existingEntryKey(lockedEntry)
      if (!lockedKey) continue

      const submittedById = submittedEntries.find((entry) => entry.entryId === lockedEntry.id)
      const submittedByKey = submittedEntries.find((entry) => entryBodyKey(entry) === lockedKey)
      const submittedEntry = submittedById ?? submittedByKey

      if (!submittedEntry) {
        errors.push(
          `Категорию «${categoryLabel(lockedEntry)}» у ${athleteName} нельзя удалить: ${getEntryPaymentStatusLabel(lockedEntry.paymentStatus as EntryPaymentStatus).toLowerCase()}.`,
        )
        continue
      }

      if (entryBodyKey(submittedEntry) !== lockedKey) {
        errors.push(
          `Категорию «${categoryLabel(lockedEntry)}» у ${athleteName} нельзя изменить: ${getEntryPaymentStatusLabel(lockedEntry.paymentStatus as EntryPaymentStatus).toLowerCase()}.`,
        )
      }

      if (submittedEntry.experienceLevel !== lockedEntry.experienceLevel) {
        errors.push(`Нельзя менять дивизион у подтверждённой категории «${categoryLabel(lockedEntry)}».`)
      }

      if (submittedEntry.entryId && submittedEntry.entryId !== lockedEntry.id) {
        errors.push('Некорректный идентификатор категории.')
      }
    }

    for (const existingEntry of existingAthlete.entries) {
      if (existingEntry.paymentStatus !== 'UNPAID' && !submittedEntryIds.has(existingEntry.id)) {
        const alreadyReported = lockedEntries.some((entry) => entry.id === existingEntry.id)
        if (!alreadyReported) {
          errors.push(`Категорию «${categoryLabel(existingEntry)}» у ${athleteName} нельзя удалить.`)
        }
      }
    }
  }

  for (const submittedAthlete of body.athletes) {
    if (!submittedAthlete.athleteId) continue
    const existingAthlete = existingById.get(submittedAthlete.athleteId)
    if (!existingAthlete) {
      errors.push('Некорректный идентификатор спортсмена.')
      continue
    }

    const existingEntryIds = new Set(existingAthlete.entries.map((entry) => entry.id))
    for (const submittedEntry of submittedAthlete.disciplineEntries) {
      if (submittedEntry.entryId && !existingEntryIds.has(submittedEntry.entryId)) {
        errors.push('Некорректный идентификатор категории.')
      }
    }
  }

  if (errors.length > 0) {
    throw new RegistrationEditError(errors)
  }
}
