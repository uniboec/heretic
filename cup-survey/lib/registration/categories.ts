import { getDisciplineLabel } from '../config/tournament'

import type { ExperienceLevelId } from '../config/experienceLevel'
import { getRegistrationCategoryIdentity, getRegistrationCategoryKey } from './categoryIdentity'
import type { EntryPaymentStatus } from './status'

export interface PublicAthleteEntry {
  id: string
  discipline: string
  ageDivisionId: string | null
  weightCategoryId: string | null
  experienceLevel: ExperienceLevelId
  categoryLabel: string
  paymentStatus: EntryPaymentStatus
  paymentStatusLabel: string
  confirmed: boolean
}

export interface PublicAthleteRow {
  fullName: string
  lastName: string
  firstName: string
  middleName: string | null
  clubName: string
  city: string
  gender: string
  birthDate: Date
  weight: number | null
  rank: string | null
  disciplines: string[]
  entries: PublicAthleteEntry[]
  paymentStatus: EntryPaymentStatus
  status: string
  hasWeighIn: boolean
}

export interface PreliminaryCategory {
  key: string
  discipline: string
  disciplineLabel: string
  title: string
  athletes: Array<{ fullName: string; clubName: string }>
  count: number
}

export function buildPreliminaryCategories(athletes: PublicAthleteRow[]): PreliminaryCategory[] {
  const map = new Map<string, PreliminaryCategory>()

  for (const athlete of athletes) {
    for (const entry of athlete.entries) {
      if (!entry.confirmed) continue
      const identity = getRegistrationCategoryIdentity(entry, athlete)
      if (!identity) continue
      const key = getRegistrationCategoryKey(identity)
      const existing = map.get(key)
      const row = { fullName: athlete.fullName, clubName: athlete.clubName }
      if (existing) {
        existing.athletes.push(row)
        existing.count += 1
      } else {
        map.set(key, {
          key,
          discipline: entry.discipline,
          disciplineLabel: getDisciplineLabel(entry.discipline),
          title: entry.categoryLabel,
          athletes: [row],
          count: 1,
        })
      }
    }
  }

  return [...map.values()].sort((a, b) =>
    a.disciplineLabel.localeCompare(b.disciplineLabel) || a.title.localeCompare(b.title),
  )
}
