import type { OlympicBronzeMode } from '@prisma/client'
import { deriveCategoryPlacements } from '../deriveCategoryPlacements'
import type { BracketStructure } from './types'

function hasValidResultStatus(result: BracketStructure['result']): boolean {
  return result?.status === 'complete' || result?.status === 'in_progress'
}

export function readCategoryResult(
  structure: BracketStructure | null | undefined,
  systemId?: string | null,
  options?: {
    participantCount?: number
    bronzeMode?: OlympicBronzeMode | null
  },
): CategoryResult | null {
  if (!structure) return null

  if (hasValidResultStatus(structure.result)) {
    const stored = structure.result ?? null
    const storedPlacements = stored?.placements?.length ?? 0
    if (
      stored?.status === 'in_progress' &&
      storedPlacements === 0 &&
      systemId
    ) {
      const derived = deriveCategoryPlacements(structure, {
        systemId,
        bronzeMode: options?.bronzeMode ?? null,
        participantCount: options?.participantCount,
      })
      if (derived.status === 'complete') {
        return derived
      }
    }
    return stored
  }

  if (systemId) {
    return deriveCategoryPlacements(structure, {
      systemId,
      bronzeMode: options?.bronzeMode ?? null,
      participantCount: options?.participantCount,
    })
  }

  return structure.result ?? null
}
