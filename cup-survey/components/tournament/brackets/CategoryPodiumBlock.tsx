'use client'

import type { CategoryResult } from '@/lib/brackets/core/types'
import { ResultMedalistRow } from './ResultMedalistRow'

interface PodiumParticipant {
  entryId: string
  displayName: string
  clubName?: string
  city?: string
}

interface CategoryPodiumBlockProps {
  result: CategoryResult | null | undefined
  participants: PodiumParticipant[]
}

export function CategoryPodiumBlock({ result, participants }: CategoryPodiumBlockProps) {
  if (!result || result.status !== 'complete' || result.placements.length === 0) {
    return null
  }

  const byEntry = new Map(participants.map((participant) => [participant.entryId, participant]))
  const sorted = [...result.placements].sort((a, b) => a.placement - b.placement)

  return (
    <section className="bracket-podium" aria-label="Призёры категории">
      <h3 className="bracket-podium__title">Призёры</h3>
      <ol className="bracket-podium__list">
        {sorted.map((placement, placementIndex) => {
          const athlete = byEntry.get(placement.entryId)
          return (
            <ResultMedalistRow
              key={`${placement.entryId}-${placement.placement}-${placementIndex}`}
              placement={placement.placement}
              displayName={athlete?.displayName ?? placement.entryId}
              clubName={athlete?.clubName ?? ''}
              city={athlete?.city ?? ''}
              provisional={placement.provisional ?? false}
            />
          )
        })}
      </ol>
    </section>
  )
}
