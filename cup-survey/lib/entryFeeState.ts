import { belts } from './config/belts'
import { cups } from './config/cups'
import { medals } from './config/medals'
import { BASE_ENTRY_FEE } from './config/pricing'
import {
  compositionNeedsBelts,
  compositionNeedsCups,
} from './config/prize-compositions'
import { getVenueById } from './config/venues'
import { syncPrimaryChoice } from './primarySelection'
import type { SurveyFormData } from './surveyDraft'

export type EntryFeeLine = {
  id: string
  label: string
  amount: number
}

export type EntryFeeState = {
  lines: EntryFeeLine[]
  total: number
}

function resolvePrimaryId(acceptable: string[], preferred: string): string {
  return syncPrimaryChoice(acceptable, preferred)
}

function primarySurcharge<T extends { surcharge: number; title?: string }>(
  acceptable: string[],
  preferred: string,
  catalog: Record<string, T>,
  fallbackLabel: string,
): { amount: number; label: string } | null {
  const id = resolvePrimaryId(acceptable, preferred)
  if (!id) return null
  const item = catalog[id as keyof typeof catalog]
  if (!item) return null
  return {
    amount: item.surcharge,
    label: item.title ? `${fallbackLabel} · ${item.title}` : fallbackLabel,
  }
}

/** Собирает текущий стартовый взнос из основных выбранных опций. */
export function buildEntryFeeState(data: SurveyFormData): EntryFeeState {
  const lines: EntryFeeLine[] = [
    { id: 'base', label: 'Базовая часть', amount: BASE_ENTRY_FEE },
  ]

  let total = BASE_ENTRY_FEE

  const venueId = resolvePrimaryId(data.acceptableVenues, data.preferredVenue)
  const venue = venueId ? getVenueById(venueId) : undefined
  if (venue) {
    lines.push({ id: 'venue', label: `Площадка · ${venue.name}`, amount: venue.surcharge })
    total += venue.surcharge
  }

  const medalLine = primarySurcharge(data.acceptableMedals, data.preferredMedal, medals, 'Медали')
  if (medalLine) {
    lines.push({ id: 'medals', label: medalLine.label, amount: medalLine.amount })
    total += medalLine.amount
  }

  if (compositionNeedsBelts(data.acceptablePrizeCompositions)) {
    const beltIds = data.acceptableBelts.filter((id) => id !== 'none')
    const beltLine = primarySurcharge(beltIds, data.preferredBelt, belts, 'Пояса')
    if (beltLine) {
      lines.push({ id: 'belts', label: beltLine.label, amount: beltLine.amount })
      total += beltLine.amount
    }
  }

  if (compositionNeedsCups(data.acceptablePrizeCompositions)) {
    const cupIds = data.acceptableCups.filter((id) => id !== 'none')
    const cupLine = primarySurcharge(cupIds, data.preferredCup, cups, 'Кубки')
    if (cupLine) {
      lines.push({ id: 'cups', label: cupLine.label, amount: cupLine.amount })
      total += cupLine.amount
    }
  }

  return { lines, total }
}
