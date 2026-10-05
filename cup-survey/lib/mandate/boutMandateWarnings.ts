import type { InternalBoutSide } from '@/lib/bouts/types'

import type { MandateWarning } from './types'

export type BoutMandateWarningAthlete = {
  corner: 'red' | 'blue'
  name: string
  entryId: string
  athleteId: string | null
  warnings: MandateWarning[]
}

function athleteEntryFromSide(
  side: InternalBoutSide,
): { entryId: string; name: string } | null {
  if (side.kind !== 'athlete') return null
  return { entryId: side.entryId, name: side.displayName }
}

export function collectEntryMandateWarningAthletes(
  corners: Array<{ corner: 'red' | 'blue'; side: InternalBoutSide }>,
  entryWarnings: Record<string, MandateWarning[]>,
  entryAthleteIds: Record<string, string>,
): BoutMandateWarningAthlete[] {
  const athletes: BoutMandateWarningAthlete[] = []

  for (const { corner, side } of corners) {
    const athlete = athleteEntryFromSide(side)
    if (!athlete) continue

    const warnings = entryWarnings[athlete.entryId] ?? []
    if (warnings.length === 0) continue

    athletes.push({
      corner,
      name: athlete.name,
      entryId: athlete.entryId,
      athleteId: entryAthleteIds[athlete.entryId] ?? null,
      warnings,
    })
  }

  return athletes
}
