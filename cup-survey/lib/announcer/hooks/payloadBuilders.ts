import type { InternalAthleteSide, InternalBout } from '@/lib/bouts/types'
import type { BoutCallPayload, BoutResultPayload, BoutSidePayload } from '../types'

function athleteSide(side: InternalAthleteSide, corner: 'red' | 'blue'): BoutSidePayload {
  return {
    corner,
    displayName: side.displayName,
    clubName: side.clubName,
    city: side.city,
  }
}

export function buildBoutCallPayload(bout: InternalBout, matIndex: number): BoutCallPayload | null {
  if (bout.sideA.kind !== 'athlete' || bout.sideB.kind !== 'athlete') return null
  return {
    boutId: bout.id,
    matIndex,
    categoryTitle: bout.categoryTitle,
    sideA: athleteSide(bout.sideA, 'red'),
    sideB: athleteSide(bout.sideB, 'blue'),
  }
}

export function buildBoutResultPayload(input: {
  bout: InternalBout
  matIndex: number
  boutResultId: string
  winnerEntryId: string
  victoryMethod: string
}): BoutResultPayload | null {
  const bout = input.bout
  if (bout.sideA.kind !== 'athlete' || bout.sideB.kind !== 'athlete') return null
  const winnerCorner =
    input.winnerEntryId === bout.sideA.entryId
      ? 'red'
      : input.winnerEntryId === bout.sideB.entryId
        ? 'blue'
        : null
  if (!winnerCorner) return null
  const winner = winnerCorner === 'red' ? bout.sideA : bout.sideB
  return {
    boutId: bout.id,
    boutResultId: input.boutResultId,
    matIndex: input.matIndex,
    winnerCorner,
    displayName: winner.displayName,
    clubName: winner.clubName,
    city: winner.city,
    victoryMethod: input.victoryMethod,
    categoryTitle: bout.categoryTitle,
  }
}
