'use client'

import type { BracketRoundMatch } from '@/lib/brackets/core/types'
import { formatAdvanceHintFromSource } from '@/lib/brackets/print/formatAdvanceHint'
import { resolveBracketMatchLabel } from '@/lib/brackets/scheduleBoutLabel'
import { resolveStaleAdvanceHintLabel } from '@/lib/brackets/scheduleHint'
import { cn } from '@/lib/cn'

export interface BracketMatchParticipant {
  entryId: string
  displayName: string
  clubName: string
  city?: string
  seedPosition: number
}

function formatParticipantMeta(clubName?: string, city?: string): string | null {
  const parts = [clubName?.trim(), city?.trim()].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

interface BracketMatchCardProps {
  match: BracketRoundMatch
  byEntry: Map<string, BracketMatchParticipant>
  categoryKey?: string
  boutsReleased?: boolean
  scheduleDisplayByBoutId?: Map<string, string>
  rounds?: BracketRoundMatch[]
  isFinal?: boolean
  showMatchLabel?: boolean
  /** Column headers already label the final round in bracket trees. */
  showFinalBadge?: boolean
  interactive?: boolean
  onSelect?: () => void
}

function ParticipantSlot({
  participant,
  position,
  pendingLabel,
  outcome,
}: {
  participant: BracketMatchParticipant | null
  position: 'top' | 'bottom'
  pendingLabel?: string
  outcome?: 'winner' | 'loser' | null
}) {
  if (!participant) {
    return (
      <div
        className={cn(
          'bracket-match__participant',
          pendingLabel ? 'bracket-match__participant--pending' : 'bracket-match__participant--bye',
          position === 'top' ? 'bracket-match__participant--top' : 'bracket-match__participant--bottom',
          outcome === 'winner' && 'bracket-match__participant--winner',
          outcome === 'loser' && 'bracket-match__participant--loser',
        )}
      >
        <span className="bracket-match__seed-col bracket-match__seed-col--empty">—</span>
        {pendingLabel ? (
          <>
            <div className="bracket-match__export-pending" aria-hidden="true">
              <span className="bracket-match__blank-line" />
              <span className="bracket-match__advance-hint">{pendingLabel}</span>
            </div>
            <span className="bracket-match__pending">{pendingLabel}</span>
          </>
        ) : (
          <span className="bracket-match__bye">Пропуск</span>
        )}
      </div>
    )
  }

  const meta = formatParticipantMeta(participant.clubName, participant.city)
  const fullTitle = [participant.displayName, meta].filter(Boolean).join(' · ')

  return (
    <div
      className={cn(
        'bracket-match__participant',
        position === 'top' ? 'bracket-match__participant--top' : 'bracket-match__participant--bottom',
        outcome === 'winner' && 'bracket-match__participant--winner',
        outcome === 'loser' && 'bracket-match__participant--loser',
      )}
      title={fullTitle}
    >
      <span className="bracket-match__seed-col" title={`Посев ${participant.seedPosition}`}>
        {participant.seedPosition}
      </span>
      <div className="bracket-match__body">
        <div className="bracket-match__name-row">
          <p className="bracket-match__name">{participant.displayName}</p>
        </div>
        {meta ? <p className="bracket-match__meta">{meta}</p> : null}
      </div>
    </div>
  )
}

export function BracketMatchCard({
  match,
  byEntry,
  categoryKey,
  boutsReleased = false,
  scheduleDisplayByBoutId,
  rounds = [],
  isFinal = false,
  showMatchLabel = false,
  showFinalBadge = false,
  interactive = false,
  onSelect,
}: BracketMatchCardProps) {
  const participantA = match.participantA
    ? (byEntry.get(match.participantA.entryId) ?? {
        entryId: match.participantA.entryId,
        displayName: match.participantA.displayName ?? '—',
        clubName: match.participantA.clubName ?? '',
        city: match.participantA.city,
        seedPosition: match.participantA.seedPosition ?? 0,
      })
    : null
  const participantB = match.participantB
    ? (byEntry.get(match.participantB.entryId) ?? {
        entryId: match.participantB.entryId,
        displayName: match.participantB.displayName ?? '—',
        clubName: match.participantB.clubName ?? '',
        city: match.participantB.city,
        seedPosition: match.participantB.seedPosition ?? 0,
      })
    : null

  const matchLabel =
    categoryKey != null
      ? resolveBracketMatchLabel({
          categoryKey,
          matchId: match.id,
          label: match.label,
          matchNumber: match.matchNumber,
          slot: match.slot,
          scheduleDisplayByBoutId,
        })
      : match.label ?? `Бой ${match.slot}`

  const resolvePendingLabel = (side: 'A' | 'B') => {
    const source = side === 'A' ? match.slotSourceA : match.slotSourceB
    const fallback = side === 'A' ? match.slotHintA : match.slotHintB
    if (source && categoryKey) {
      return (
        formatAdvanceHintFromSource(rounds, source, {
          categoryKey,
          released: boutsReleased,
          scheduleDisplayByBoutId,
          fallbackHint: fallback,
        }) ?? fallback
      )
    }
    if (categoryKey && fallback) {
      return (
        resolveStaleAdvanceHintLabel({
          label: fallback,
          categoryKey,
          released: boutsReleased,
          scheduleDisplayByBoutId,
        }) ?? fallback
      )
    }
    return fallback
  }

  const winnerEntryId = match.winnerEntryId ?? null
  const outcomeFor = (entryId: string | undefined) => {
    if (!winnerEntryId || !entryId) return null
    if (entryId === winnerEntryId) return 'winner' as const
    if (match.loserEntryId && entryId === match.loserEntryId) return 'loser' as const
    return null
  }

  const isClickable = interactive && Boolean(onSelect)

  return (
    <div
      className={cn(
        'bracket-match',
        isFinal && 'bracket-match--final',
        isClickable && 'bracket-match--interactive',
      )}
      data-match-id={match.id}
      aria-label={matchLabel}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onSelect : undefined}
      onKeyDown={
        isClickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect?.()
              }
            }
          : undefined
      }
    >
      {isFinal && showFinalBadge && (
        <div className="bracket-match__final-badge" aria-hidden="true">
          <span className="bracket-match__final-icon">🏆</span>
          <span>Финал</span>
        </div>
      )}
      {showMatchLabel && !isFinal && (
        <p className="bracket-match__round-index">{matchLabel}</p>
      )}
      <ParticipantSlot
        participant={participantA}
        position="top"
        pendingLabel={resolvePendingLabel('A')}
        outcome={outcomeFor(participantA?.entryId)}
      />
      <ParticipantSlot
        participant={participantB}
        position="bottom"
        pendingLabel={resolvePendingLabel('B')}
        outcome={outcomeFor(participantB?.entryId)}
      />
    </div>
  )
}
