import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import type { InternalBout, InternalBoutSide } from './types'

export type EntryToAthleteMap = Map<string, string>

function athleteIdFromSide(
  side: InternalBoutSide,
  entryToAthlete: EntryToAthleteMap,
): string | null {
  if (side.kind !== 'athlete') return null
  return entryToAthlete.get(side.entryId) ?? null
}

export function collectKnownAthleteIds(
  bout: InternalBout,
  entryToAthlete: EntryToAthleteMap,
): string[] {
  const ids = [
    athleteIdFromSide(bout.sideA, entryToAthlete),
    athleteIdFromSide(bout.sideB, entryToAthlete),
  ].filter((id): id is string => id != null)
  return [...new Set(ids)]
}

export function collectEntryIdsFromBouts(bouts: InternalBout[]): string[] {
  const ids = new Set<string>()
  for (const bout of bouts) {
    if (bout.sideA.kind === 'athlete') ids.add(bout.sideA.entryId)
    if (bout.sideB.kind === 'athlete') ids.add(bout.sideB.entryId)
  }
  return [...ids]
}

export async function loadEntryToAthleteMap(
  entryIds: string[],
  db?: Prisma.TransactionClient,
): Promise<EntryToAthleteMap> {
  if (entryIds.length === 0) return new Map()
  const client = db ?? prisma
  const rows = await client.athleteEntry.findMany({
    where: { id: { in: entryIds } },
    select: { id: true, athleteId: true },
  })
  return new Map(rows.map((row) => [row.id, row.athleteId]))
}

export async function loadEntryToAthleteMapForBouts(
  bouts: InternalBout[],
  db?: Prisma.TransactionClient,
): Promise<EntryToAthleteMap> {
  return loadEntryToAthleteMap(collectEntryIdsFromBouts(bouts), db)
}
