import type { CategoryPlacement, CategoryResult } from '@/lib/brackets/core/types'
import type { CeremonyParticipantInput } from './types'

export function parseDisplayName(displayName: string): {
  lastName: string
  firstName: string
  middleName: string | null
} {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  return {
    lastName: parts[0] ?? '',
    firstName: parts[1] ?? '',
    middleName: parts.length > 2 ? parts.slice(2).join(' ') : null,
  }
}

export function sortPlacements(placements: CategoryPlacement[]): CategoryPlacement[] {
  return [...placements].sort((left, right) => {
    if (left.placement !== right.placement) {
      return left.placement - right.placement
    }
    return 0
  })
}

export function buildPlacementRows(input: {
  result: CategoryResult
  participants: CeremonyParticipantInput[]
}): Array<{
  entryId: string
  placement: number
  placementIndex: number
  lastName: string
  firstName: string
  middleName: string | null
  clubName: string
}> {
  const placements = sortPlacements(input.result.placements)
  const rows: Array<{
    entryId: string
    placement: number
    placementIndex: number
    lastName: string
    firstName: string
    middleName: string | null
    clubName: string
  }> = []

  placements.forEach((placement, placementIndex) => {
    const participant = input.participants.find((item) => item.entryId === placement.entryId)
    const names = parseDisplayName(participant?.displayName ?? placement.entryId)
    rows.push({
      entryId: placement.entryId,
      placement: placement.placement,
      placementIndex,
      lastName: names.lastName,
      firstName: names.firstName,
      middleName: names.middleName,
      clubName: participant?.clubName ?? '',
    })
  })

  return rows
}
