'use client'

import type { BracketStructure } from '@/lib/brackets/core/types'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'
import type { BracketMatchParticipant } from '../../BracketMatchCard'

interface ChampionCategoryCardProps {
  structure: BracketStructure
  participants: BracketMatchParticipant[]
}

export function ChampionCategoryCard({ structure, participants }: ChampionCategoryCardProps) {
  const championEntryId = structure.champion?.entryId ?? structure.result?.placements[0]?.entryId
  const participant =
    participants.find((item) => item.entryId === championEntryId) ??
    (structure.champion
      ? {
          entryId: structure.champion.entryId,
          displayName: structure.champion.displayName,
          clubName: structure.champion.clubName,
          city: structure.champion.city,
          seedPosition: 1,
        }
      : null)

  if (!participant) {
    return <div className={tournamentPublicUi.bracketEmpty}>Победитель категории не найден</div>
  }

  const clubLine = [participant.clubName.trim(), participant.city?.trim()].filter(Boolean).join(' · ')

  return (
    <div className={tournamentPublicUi.championCard}>
      <p className={tournamentPublicUi.championLabel}>{structure.label ?? 'Победитель категории'}</p>
      <div>
        <p className={tournamentPublicUi.championName}>{participant.displayName}</p>
        {clubLine ? <p className={tournamentPublicUi.championClub}>{clubLine}</p> : null}
        <p className={tournamentPublicUi.championPlacement}>1 место</p>
      </div>
    </div>
  )
}
