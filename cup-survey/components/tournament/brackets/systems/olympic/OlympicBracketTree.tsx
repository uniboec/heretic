'use client'

import { useMemo, useSyncExternalStore } from 'react'
import type { BracketStructure } from '@/lib/brackets/core/types'
import { cn } from '@/lib/cn'
import { BracketMatchCard, type BracketMatchParticipant } from '../../BracketMatchCard'
import { BronzeBlock } from '../../BronzeBlock'
import { getOlympicRoundLabel, getSlotFlexWeight } from '../../olympicLayout'
import {
  buildBracketGeometryStyle,
  getOlympicLayout,
  getSlotHeightPx,
  type OlympicLayoutOptions,
} from './olympicBracketGeometry'
import { BracketSystemViewport } from '../../BracketSystemViewport'
import { OlympicBracketSvgConnectors } from './OlympicBracketSvgConnectors'

const MOBILE_BRACKET_MQ = 'not (min-width: 768px)'

function subscribeMobileBracket(listener: () => void) {
  const mq = window.matchMedia(MOBILE_BRACKET_MQ)
  mq.addEventListener('change', listener)
  return () => mq.removeEventListener('change', listener)
}

function getIsMobileBracket() {
  return window.matchMedia(MOBILE_BRACKET_MQ).matches
}

function subscribeViewportWidth(listener: () => void) {
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}

function getViewportWidth() {
  return window.innerWidth
}

type OlympicMatch = BracketStructure['rounds'][number]

interface OlympicBracketTreeProps {
  structure: BracketStructure
  participants: BracketMatchParticipant[]
  interactive?: boolean
  categoryKey?: string
  boutsReleased?: boolean
  scheduleDisplayByBoutId?: Map<string, string>
  onMatchSelect?: (match: OlympicMatch) => void
  onBronzeSelect?: (slot: NonNullable<BracketStructure['bronzeSlots']>[number]) => void
}

export function OlympicBracketTree({
  structure,
  participants,
  interactive = false,
  categoryKey,
  boutsReleased = false,
  scheduleDisplayByBoutId,
  onMatchSelect,
  onBronzeSelect,
}: OlympicBracketTreeProps) {
  const isMobile = useSyncExternalStore(subscribeMobileBracket, getIsMobileBracket, () => false)
  const viewportWidth = useSyncExternalStore(subscribeViewportWidth, getViewportWidth, () => 390)
  const byEntry = new Map(participants.map((p) => [p.entryId, p]))
  const maxRound = structure.rounds.reduce((max, match) => Math.max(max, match.round), 1)
  const rounds = Array.from({ length: maxRound }, (_, index) => index + 1)
  const firstRoundMatchCount = structure.rounds.filter((match) => match.round === 1).length
  const isCompact = firstRoundMatchCount <= 2
  const layoutOptions = useMemo((): OlympicLayoutOptions | undefined => {
    return isMobile ? { isMobile: true, viewportWidth } : undefined
  }, [isMobile, viewportWidth])
  const layout = getOlympicLayout(isCompact, layoutOptions)
  const slotHeightPx = getSlotHeightPx(firstRoundMatchCount, isCompact, layoutOptions)
  const geometryStyle = buildBracketGeometryStyle(layout, firstRoundMatchCount, slotHeightPx)

  return (
    <div
      className={cn('bracket-olympic', isCompact && 'bracket-olympic--compact')}
      style={geometryStyle}
    >
      <BracketSystemViewport showHint={maxRound > 1}>
        <div className="bracket-tree__rounds">
          <OlympicBracketSvgConnectors
            maxRound={maxRound}
            firstRoundMatchCount={firstRoundMatchCount}
            isCompact={isCompact}
            layoutOptions={layoutOptions}
          />
          {rounds.map((round) => {
            const matches = structure.rounds.filter((match) => match.round === round)
            const label = getOlympicRoundLabel(round, maxRound, matches.length)
            const isFinal = round === maxRound && matches.length === 1
            const isFirstRound = round === 1
            const slotFlex = getSlotFlexWeight(round)

            return (
              <div
                key={round}
                className={cn(
                  'bracket-tree__column',
                  isFinal && 'bracket-tree__column--final',
                  isFirstRound && 'bracket-tree__column--first-round',
                )}
                data-round={round}
              >
                <p className="bracket-tree__round-label">{label}</p>
                <div className="bracket-tree__column-body">
                  {matches.map((match) => (
                    <div
                      key={match.id}
                      className="bracket-tree__slot"
                      style={{ flex: `${slotFlex} 0 0` }}
                    >
                      <div className="bracket-tree__slot-content">
                        <BracketMatchCard
                          match={match}
                          byEntry={byEntry}
                          categoryKey={categoryKey}
                          boutsReleased={boutsReleased}
                          scheduleDisplayByBoutId={scheduleDisplayByBoutId}
                          rounds={structure.rounds}
                          isFinal={isFinal}
                          showMatchLabel={matches.length > 1}
                          interactive={interactive}
                          onSelect={onMatchSelect ? () => onMatchSelect(match) : undefined}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
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
