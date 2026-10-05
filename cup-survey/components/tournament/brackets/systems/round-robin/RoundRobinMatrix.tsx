'use client'

import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'
import type { BracketRoundMatch, BracketStructure, CategoryResult } from '@/lib/brackets/core/types'
import { formatBoutLabel } from '@/lib/brackets/labels'
import { BracketSystemViewport } from '../../BracketSystemViewport'
import { BracketMatchCard, type BracketMatchParticipant } from '../../BracketMatchCard'

type RoundRobinMatch = BracketRoundMatch

interface RoundRobinMatrixProps {
  structure: BracketStructure
  participants: BracketMatchParticipant[]
  result?: CategoryResult | null
  interactive?: boolean
  categoryKey?: string
  boutsReleased?: boolean
  scheduleDisplayByBoutId?: Map<string, string>
  onMatchSelect?: (match: RoundRobinMatch) => void
}

function toBoutMatch(
  pair: NonNullable<BracketStructure['roundRobinPairs']>[number],
  fallbackNumber: number,
): BracketRoundMatch {
  const matchNumber = pair.matchNumber ?? fallbackNumber
  return {
    id: `rr-${matchNumber}`,
    round: pair.round,
    slot: 1,
    matchNumber,
    label: formatBoutLabel(matchNumber),
    participantA: { entryId: pair.entryIdA } as BracketRoundMatch['participantA'],
    participantB: { entryId: pair.entryIdB } as BracketRoundMatch['participantB'],
    winnerEntryId: pair.winnerEntryId,
    loserEntryId: pair.loserEntryId,
  }
}

export function RoundRobinMatrix({
  structure,
  participants,
  result,
  interactive = false,
  categoryKey,
  boutsReleased = false,
  scheduleDisplayByBoutId,
  onMatchSelect,
}: RoundRobinMatrixProps) {
  const byEntry = new Map(participants.map((participant) => [participant.entryId, participant]))
  const pairs = structure.roundRobinPairs ?? []
  const standings = structure.roundRobinStandings ?? []
  const medalEntryIds = new Set(
    result?.status === 'complete'
      ? result.placements.map((placement) => placement.entryId)
      : [],
  )

  if (pairs.length === 0) {
    return (
      <div className={tournamentPublicUi.bracketEmpty}>Сетка по круговой системе пока не сформирована</div>
    )
  }

  const bouts = [...pairs]
    .map((pair, index) => toBoutMatch(pair, index + 1))
    .sort((a, b) => a.matchNumber - b.matchNumber)

  return (
    <div className="bracket-rr">
      {standings.length > 0 ? (
        <div className="bracket-rr__standings">
          <h3 className="bracket-rr__standings-title">Турнирная таблица</h3>
          <table className="bracket-rr__standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Участник</th>
                <th>В</th>
                <th>П</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, index) => {
                const athlete = byEntry.get(row.entryId)
                const isMedalist = medalEntryIds.has(row.entryId)
                return (
                  <tr
                    key={row.entryId}
                    className={isMedalist ? 'bracket-rr__standings-row--medalist' : undefined}
                  >
                    <td>{index + 1}</td>
                    <td>{athlete?.displayName ?? row.entryId}</td>
                    <td>{row.wins}</td>
                    <td>{row.losses}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <BracketSystemViewport>
        <div className="bracket-bout-list">
          {bouts.map((match) => (
            <BracketMatchCard
              key={match.id}
              match={match}
              byEntry={byEntry}
              categoryKey={categoryKey}
              boutsReleased={boutsReleased}
              scheduleDisplayByBoutId={scheduleDisplayByBoutId}
              rounds={bouts}
              showMatchLabel
              interactive={interactive}
              onSelect={onMatchSelect ? () => onMatchSelect(match) : undefined}
            />
          ))}
        </div>
      </BracketSystemViewport>
    </div>
  )
}
