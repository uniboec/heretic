'use client'

import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'
import type { BracketStructure, CategoryResult } from '@/lib/brackets/core/types'
import { CategoryPodiumBlock } from './CategoryPodiumBlock'
import type { BracketMatchParticipant } from './BracketMatchCard'
import { OlympicBracketTree } from './systems/olympic/OlympicBracketTree'
import { RoundRobinMatrix } from './systems/round-robin/RoundRobinMatrix'
import { ThreeWayBracketTree } from './systems/three-way/ThreeWayBracketTree'
import { ChampionCategoryCard } from './systems/champion/ChampionCategoryCard'
import { bracketMatchHasBothAthletes } from '@/lib/bouts/boutReadiness'
import { formatAdvanceHintFromSource } from '@/lib/brackets/print/formatAdvanceHint'
import { resolveBracketMatchLabel } from '@/lib/brackets/scheduleBoutLabel'
import { resolveStaleAdvanceHintLabel } from '@/lib/brackets/scheduleHint'
import type { BracketRoundMatch } from '@/lib/brackets/core/types'

export type AdminBracketMatchSelectInput = {
  localMatchId: string
  label: string
  winnerEntryId?: string | null
  loserEntryId?: string | null
  sideALabel: string
  sideBLabel: string
  sidesReady: boolean
}

interface BracketSystemRendererProps {
  systemId: string | null
  structure: BracketStructure | null
  participants: BracketMatchParticipant[]
  result?: CategoryResult | null
  variant?: 'event' | 'admin'
  categoryKey?: string
  boutsReleased?: boolean
  scheduleDisplayByBoutId?: Map<string, string>
  onAdminMatchSelect?: (input: AdminBracketMatchSelectInput) => void
}

export function BracketSystemRenderer({
  systemId,
  structure,
  participants,
  result,
  variant = 'event',
  categoryKey,
  boutsReleased = false,
  scheduleDisplayByBoutId,
  onAdminMatchSelect,
}: BracketSystemRendererProps) {
  const resolvedResult = result ?? structure?.result ?? null
  const resolvedSystemId = structure?.systemId ?? systemId

  if (!structure || !resolvedSystemId) {
    return <div className={tournamentPublicUi.bracketEmpty}>Сетка недоступна для этой категории</div>
  }

  const treeClassName = variant === 'admin' ? 'bracket-tree bracket-tree--admin' : 'bracket-tree'
  const interactive = variant === 'admin' && Boolean(onAdminMatchSelect)
  const byEntry = new Map(participants.map((participant) => [participant.entryId, participant]))

  const resolveSideHint = (
    side: 'A' | 'B',
    match: BracketRoundMatch,
    participant: BracketMatchParticipant | null,
  ) => {
    if (participant?.displayName) {
      return participant.displayName
    }
    const source = side === 'A' ? match.slotSourceA : match.slotSourceB
    const fallback = side === 'A' ? match.slotHintA : match.slotHintB
    if (source && categoryKey) {
      return (
        formatAdvanceHintFromSource(structure.rounds, source, {
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

  const selectMatch = (match: BracketRoundMatch) => {
    if (!onAdminMatchSelect) return
    const participantA = match.participantA
      ? byEntry.get(match.participantA.entryId) ?? null
      : null
    const participantB = match.participantB
      ? byEntry.get(match.participantB.entryId) ?? null
      : null

    onAdminMatchSelect({
      localMatchId: match.id,
      label:
        categoryKey != null
          ? resolveBracketMatchLabel({
              categoryKey,
              matchId: match.id,
              label: match.label,
              matchNumber: match.matchNumber,
              slot: match.slot,
              scheduleDisplayByBoutId,
            })
          : match.label ?? `Слот ${match.slot ?? '—'}`,
      winnerEntryId: match.winnerEntryId,
      loserEntryId: match.loserEntryId,
      sideALabel: resolveSideHint('A', match, participantA) ?? '—',
      sideBLabel: resolveSideHint('B', match, participantB) ?? '—',
      sidesReady: bracketMatchHasBothAthletes(match),
    })
  }

  if (resolvedSystemId === 'round_robin') {
    return (
      <div className={treeClassName}>
        <CategoryPodiumBlock result={resolvedResult} participants={participants} />
        <RoundRobinMatrix
          structure={structure}
          participants={participants}
          result={resolvedResult}
          interactive={interactive}
          categoryKey={categoryKey}
          boutsReleased={boutsReleased}
          scheduleDisplayByBoutId={scheduleDisplayByBoutId}
          onMatchSelect={selectMatch}
        />
      </div>
    )
  }

  if (resolvedSystemId === 'champion') {
    return (
      <div className={treeClassName}>
        <ChampionCategoryCard structure={structure} participants={participants} />
      </div>
    )
  }

  if (resolvedSystemId === 'three_way') {
    return (
      <div className={treeClassName}>
        <CategoryPodiumBlock result={resolvedResult} participants={participants} />
        <ThreeWayBracketTree
          structure={structure}
          participants={participants}
          interactive={interactive}
          categoryKey={categoryKey}
          boutsReleased={boutsReleased}
          scheduleDisplayByBoutId={scheduleDisplayByBoutId}
          onMatchSelect={selectMatch}
          onBronzeSelect={
            onAdminMatchSelect
              ? (bronze) =>
                  onAdminMatchSelect({
                    localMatchId: bronze.id,
                    label: bronze.label,
                    winnerEntryId: bronze.winnerEntryId,
                    loserEntryId: bronze.loserEntryId,
                    sideALabel: bronze.hintA ?? '—',
                    sideBLabel: bronze.hintB ?? '—',
                    sidesReady: false,
                  })
              : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className={treeClassName}>
      <CategoryPodiumBlock result={resolvedResult} participants={participants} />
      <OlympicBracketTree
        structure={structure}
        participants={participants}
        interactive={interactive}
        categoryKey={categoryKey}
        boutsReleased={boutsReleased}
        scheduleDisplayByBoutId={scheduleDisplayByBoutId}
        onMatchSelect={selectMatch}
        onBronzeSelect={
          onAdminMatchSelect
            ? (bronze) =>
                onAdminMatchSelect({
                  localMatchId: bronze.id,
                  label: bronze.label,
                  winnerEntryId: bronze.winnerEntryId,
                  loserEntryId: bronze.loserEntryId,
                  sideALabel: bronze.hintA ?? '—',
                  sideBLabel: bronze.hintB ?? '—',
                  sidesReady: false,
                })
            : undefined
        }
      />
    </div>
  )
}
