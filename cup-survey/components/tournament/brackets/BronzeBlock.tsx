'use client'

import type { BracketRoundMatch } from '@/lib/brackets/core/types'
import { formatAdvanceHintFromSource } from '@/lib/brackets/print/formatAdvanceHint'
import { resolveBronzeSingleAthlete } from '@/lib/brackets/resolveBronzeSlotAthlete'
import {
  resolveBronzeFightTitle,
  resolveStaleAdvanceHintLabel,
} from '@/lib/brackets/scheduleHint'
import type { BracketMatchParticipant } from './BracketMatchCard'
import { cn } from '@/lib/cn'

interface BronzeSlot {
  id: string
  label: string
  hintA?: string
  hintB?: string
  sourceA?: BracketRoundMatch['slotSourceA']
  sourceB?: BracketRoundMatch['slotSourceB']
  entryIdA?: string
  entryIdB?: string
  winnerEntryId?: string | null
  loserEntryId?: string | null
}

interface BronzeBlockProps {
  slots?: BronzeSlot[]
  participants?: BracketMatchParticipant[]
  interactive?: boolean
  categoryKey?: string
  boutsReleased?: boolean
  scheduleDisplayByBoutId?: Map<string, string>
  rounds?: BracketRoundMatch[]
  onBronzeSelect?: (slot: BronzeSlot) => void
}

function entryIdForHint(
  hint: string | undefined,
  byEntry: Map<string, BracketMatchParticipant>,
): string | null {
  if (!hint) return null
  for (const [entryId, participant] of byEntry) {
    if (participant.displayName === hint) return entryId
  }
  return null
}

function outcomeForEntry(
  entryId: string | null,
  winnerEntryId?: string | null,
  loserEntryId?: string | null,
): 'winner' | 'loser' | null {
  if (!entryId) return null
  if (winnerEntryId && entryId === winnerEntryId) return 'winner'
  if (loserEntryId && entryId === loserEntryId) return 'loser'
  return null
}

function resolveBronzeSideLabel(
  side: 'A' | 'B',
  fight: BronzeSlot,
  byEntry: Map<string, BracketMatchParticipant>,
  options: {
    categoryKey?: string
    boutsReleased?: boolean
    scheduleDisplayByBoutId?: Map<string, string>
    rounds?: BracketRoundMatch[]
  },
): string {
  const entryId = side === 'A' ? fight.entryIdA : fight.entryIdB
  if (entryId) {
    return byEntry.get(entryId)?.displayName ?? (side === 'A' ? fight.hintA : fight.hintB) ?? ''
  }

  const source = side === 'A' ? fight.sourceA : fight.sourceB
  const fallback = side === 'A' ? fight.hintA : fight.hintB
  if (source && options.rounds && options.categoryKey) {
    return (
      formatAdvanceHintFromSource(options.rounds, source, {
        categoryKey: options.categoryKey,
        released: options.boutsReleased === true,
        scheduleDisplayByBoutId: options.scheduleDisplayByBoutId,
        fallbackHint: fallback,
      }) ?? fallback ?? ''
    )
  }

  if (options.categoryKey && fallback) {
    return (
      resolveStaleAdvanceHintLabel({
        label: fallback,
        categoryKey: options.categoryKey,
        released: options.boutsReleased === true,
        scheduleDisplayByBoutId: options.scheduleDisplayByBoutId,
      }) ?? fallback
    )
  }

  return fallback ?? ''
}

function resolveBronzeSlotTitle(
  slot: BronzeSlot,
  categoryKey?: string,
  scheduleDisplayByBoutId?: Map<string, string>,
): string {
  if (categoryKey) {
    if (slot.id === 'bronze-fight') {
      return resolveBronzeFightTitle({
        matchId: slot.id,
        label: slot.label,
        categoryKey,
        scheduleDisplayByBoutId,
      })
    }

    const resolved = resolveStaleAdvanceHintLabel({
      label: slot.label,
      categoryKey,
      released: true,
      scheduleDisplayByBoutId,
    })
    if (resolved) return resolved
  }

  return slot.label
}

function BronzeAthleteSlot({
  label,
  subtitle,
  outcome,
  pendingHint = false,
}: {
  label: string
  subtitle?: string
  outcome?: 'winner' | 'loser' | null
  pendingHint?: boolean
}) {
  if (!label) {
    return (
      <div className="bracket-bronze__slot bracket-bronze__slot--pending">
        <p className="bracket-match__pending" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bracket-bronze__slot',
        pendingHint && 'bracket-bronze__slot--pending',
        outcome === 'winner' && 'bracket-bronze__slot--winner',
        outcome === 'loser' && 'bracket-bronze__slot--loser',
      )}
    >
      {pendingHint ? (
        <div className="bracket-match__export-pending" aria-hidden="true">
          <span className="bracket-match__blank-line" />
          <span className="bracket-match__advance-hint">{label}</span>
        </div>
      ) : null}
      <p className={cn('bracket-bronze__athlete', pendingHint && 'bracket-match__screen-pending')}>
        {label}
      </p>
      {subtitle && !pendingHint ? (
        <p className="mt-0.5 text-[0.6875rem] leading-snug text-muted">{subtitle}</p>
      ) : null}
    </div>
  )
}

export function BronzeBlock({
  slots,
  participants,
  interactive = false,
  categoryKey,
  boutsReleased = false,
  scheduleDisplayByBoutId,
  rounds,
  onBronzeSelect,
}: BronzeBlockProps) {
  if (!slots?.length) return null

  const byEntry = new Map((participants ?? []).map((participant) => [participant.entryId, participant]))
  const hintOptions = {
    categoryKey,
    boutsReleased,
    scheduleDisplayByBoutId,
    rounds,
  }

  if (slots.length === 1 && slots[0].id === 'bronze-fight') {
    const fight = slots[0]
    const labelA = resolveBronzeSideLabel('A', fight, byEntry, hintOptions)
    const labelB = resolveBronzeSideLabel('B', fight, byEntry, hintOptions)
    const entryA = fight.entryIdA ?? entryIdForHint(fight.hintA, byEntry)
    const entryB = fight.entryIdB ?? entryIdForHint(fight.hintB, byEntry)

    const clickable = interactive && Boolean(onBronzeSelect)

    return (
      <div
        className={cn('bracket-bronze bracket-bronze--one', clickable && 'bracket-bronze--interactive')}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? () => onBronzeSelect?.(fight) : undefined}
        onKeyDown={
          clickable
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onBronzeSelect?.(fight)
                }
              }
            : undefined
        }
      >
        <div className="bracket-bronze__header">
          <span className="bracket-bronze__medal" aria-hidden="true">🥉</span>
          <p className="bracket-bronze__title">
            {resolveBronzeSlotTitle(fight, categoryKey, scheduleDisplayByBoutId)}
          </p>
        </div>
        <div className="bracket-bronze__grid bracket-bronze__grid--fight">
          <BronzeAthleteSlot
            label={labelA}
            pendingHint={!entryA && Boolean(labelA)}
            outcome={outcomeForEntry(entryA, fight.winnerEntryId, fight.loserEntryId)}
          />
          <div className="bracket-bronze__versus" aria-hidden="true">—</div>
          <BronzeAthleteSlot
            label={labelB}
            pendingHint={!entryB && Boolean(labelB)}
            outcome={outcomeForEntry(entryB, fight.winnerEntryId, fight.loserEntryId)}
          />
        </div>
      </div>
    )
  }

  const title =
    slots.length === 1 && slots[0].id === 'third-place' ? '3-е место' : 'Бронзовые места'

  return (
    <div className="bracket-bronze bracket-bronze--two">
      <div className="bracket-bronze__header">
        <span className="bracket-bronze__medal" aria-hidden="true">🥉</span>
        <p className="bracket-bronze__title">{title}</p>
      </div>
      <div className="bracket-bronze__grid">
        {slots.map((slot) => {
          const resolved = resolveBronzeSingleAthlete(slot, byEntry, hintOptions)
          const conditionHint = resolveBronzeSlotTitle(slot, categoryKey, scheduleDisplayByBoutId)
          const clickable = interactive && Boolean(onBronzeSelect)

          return (
            <div
              key={slot.id}
              className={cn(clickable && 'bracket-bronze--interactive')}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onBronzeSelect?.(slot) : undefined}
              onKeyDown={
                clickable
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onBronzeSelect?.(slot)
                      }
                    }
                  : undefined
              }
            >
              <BronzeAthleteSlot
                label={resolved.label}
                subtitle={!resolved.pendingHint ? conditionHint : undefined}
                pendingHint={resolved.pendingHint}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
