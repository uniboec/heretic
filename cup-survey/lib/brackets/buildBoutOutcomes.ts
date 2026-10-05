import type { BoutResult } from '@prisma/client'
import type { BracketStructure } from './core/types'
import { extractBouts } from '../bouts/extractBouts'
import type { BoutCategoryMeta } from '../bouts/types'

export type BoutOutcomeDto = {
  winnerEntryId: string | null
  loserEntryId: string | null
  victoryMethod: string | null
  mainRedScore: number
  mainBlueScore: number
}

function localMatchIdFromBoutId(boutId: string): string {
  const sep = boutId.lastIndexOf('::')
  return sep >= 0 ? boutId.slice(sep + 2) : boutId
}

export function buildBoutOutcomesMap(
  results: BoutResult[],
): Record<string, BoutOutcomeDto> {
  const map: Record<string, BoutOutcomeDto> = {}
  for (const result of results) {
    const localId = localMatchIdFromBoutId(result.boutId)
    map[localId] = {
      winnerEntryId: result.winnerEntryId,
      loserEntryId: result.loserEntryId,
      victoryMethod: result.victoryMethod,
      mainRedScore: result.mainRedScore,
      mainBlueScore: result.mainBlueScore,
    }
  }
  return map
}

export function collectCategoryBoutIds(
  structure: BracketStructure,
  categoryMeta: BoutCategoryMeta,
): string[] {
  return extractBouts(structure, categoryMeta).map((bout) => bout.id)
}
