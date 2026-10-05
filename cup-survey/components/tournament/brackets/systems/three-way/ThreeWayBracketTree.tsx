'use client'

import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'
import type { BracketStructure } from '@/lib/brackets/core/types'
import { BracketMatchCard, type BracketMatchParticipant } from '../../BracketMatchCard'
import { BracketSystemViewport } from '../../BracketSystemViewport'
import { BronzeBlock } from '../../BronzeBlock'

type ThreeWayMatch = BracketStructure['rounds'][number]

interface ThreeWayBracketTreeProps {
  structure: BracketStructure
  participants: BracketMatchParticipant[]
  interactive?: boolean
  categoryKey?: string
  boutsReleased?: boolean
  scheduleDisplayByBoutId?: Map<string, string>
  onMatchSelect?: (match: ThreeWayMatch) => void
  onBronzeSelect?: (slot: NonNullable<BracketStructure['bronzeSlots']>[number]) => void
}

export function ThreeWayBracketTree({
  structure,
  participants,
  interactive = false,
  categoryKey,
  boutsReleased = false,
  scheduleDisplayByBoutId,
  onMatchSelect,
  onBronzeSelect,
}: ThreeWayBracketTreeProps) {
  const byEntry = new Map(participants.map((p) => [p.entryId, p]))
  const bout1 = structure.rounds.find((m) => m.round === 1)
  const bout2 = structure.rounds.find((m) => m.round === 2)
  const final = structure.rounds.find((m) => m.round === 3)

  if (!bout1 || !bout2 || !final) {
    return (
      <div className={tournamentPublicUi.bracketEmpty}>Сетка «Тройка с возвратом» пока не сформирована</div>
    )
  }

  const bouts = [bout1, bout2, final]

  return (
    <div className="bracket-rr bracket-three-way">
      <BracketSystemViewport showHint={false}>
        <div className="bracket-bout-list">
          {bouts.map((match) => (
            <BracketMatchCard
              key={match.id}
              match={match}
              byEntry={byEntry}
              categoryKey={categoryKey}
              boutsReleased={boutsReleased}
              scheduleDisplayByBoutId={scheduleDisplayByBoutId}
              rounds={structure.rounds}
              showMatchLabel
              interactive={interactive}
              onSelect={onMatchSelect ? () => onMatchSelect(match) : undefined}
            />
          ))}
        </div>
      </BracketSystemViewport>

      <BronzeBlock
        slots={structure.bronzeSlots}
        participants={participants}
        interactive={interactive}
        categoryKey={categoryKey}
        boutsReleased={boutsReleased}
        scheduleDisplayByBoutId={scheduleDisplayByBoutId}
        rounds={structure.rounds}
        onBronzeSelect={onBronzeSelect}
      />
    </div>
  )
}
