import type { ExperienceLevelId } from '../config/experienceLevel'
import { getExperienceLevel } from '../config/experienceLevel'
import type { EntryPaymentStatus } from './status'
import {
  getEntryPaymentStatusLabel,
  getPublicEntryPaymentStatusLabel,
  toPublicEntryPaymentStatus,
} from './status'
import { getTournamentCategoryLabel } from './categoryRules'

export interface SerializedDisciplineEntry {
  id: string
  discipline: string
  ageDivisionId: string | null
  weightCategoryId: string | null
  experienceLevel: ExperienceLevelId
  categoryLabel: string
  price: number
  paymentStatus: EntryPaymentStatus
  paymentStatusLabel: string
}

export function serializeAthleteEntries(
  entries: Array<{
    id: string
    discipline: string
    ageDivisionId: string | null
    weightCategoryId: string | null
    experienceLevel: string
    price: number
    paymentStatus: string
  }>,
  rank: string | null | undefined,
  options?: { publicView?: boolean },
): SerializedDisciplineEntry[] {
  const publicView = options?.publicView ?? false

  return entries.map((entry) => {
    const experienceLevel = (entry.experienceLevel || getExperienceLevel(rank)) as ExperienceLevelId
    const rawPaymentStatus = entry.paymentStatus as EntryPaymentStatus
    const paymentStatus = publicView
      ? toPublicEntryPaymentStatus(rawPaymentStatus)
      : rawPaymentStatus

    return {
      id: entry.id,
      discipline: entry.discipline,
      ageDivisionId: entry.ageDivisionId,
      weightCategoryId: entry.weightCategoryId,
      experienceLevel,
      categoryLabel:
        entry.ageDivisionId && entry.weightCategoryId
          ? getTournamentCategoryLabel(entry.ageDivisionId, entry.weightCategoryId, experienceLevel)
          : 'Категория уточняется',
      price: entry.price,
      paymentStatus,
      paymentStatusLabel: publicView
        ? getPublicEntryPaymentStatusLabel(rawPaymentStatus)
        : getEntryPaymentStatusLabel(rawPaymentStatus),
    }
  })
}
