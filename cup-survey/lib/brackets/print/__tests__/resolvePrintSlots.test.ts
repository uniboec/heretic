import { describe, expect, it } from 'vitest'
import { buildOlympicV1 } from '../../systems/olympic/v1/build'
import { buildThreeWayV1 } from '../../systems/three-way/v1/build'
import type { BracketExportCategory } from '../../export/types'
import {
  buildSlotContext,
  isAthleteSlot,
  isBlankSlot,
  resolveMatchSlot,
  resolveWinnerAdvance,
} from '../resolvePrintSlots'

function participants(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    entryId: `e${index + 1}`,
    seedPosition: index + 1,
    displayName: `Athlete ${index + 1}`,
    clubName: `Club ${index + 1}`,
    city: 'City',
  }))
}

function category(partial: Partial<BracketExportCategory>): BracketExportCategory {
  return {
    categoryKey: 'cat',
    title: 'Test',
    discipline: 'TC',
    matIndex: 1,
    competitionStage: 1,
    effectiveSystemId: 'olympic',
    effectiveBronzeMode: 'ONE',
    participantCount: 4,
    structure: { systemId: 'olympic', systemVersion: 1, rounds: [] },
    participants: participants(4),
    boutOutcomes: {},
    result: null,
    ...partial,
  }
}

describe('resolvePrintSlots', () => {
  it('semifinal not finished → final slot is blank advance', () => {
    const built = buildOlympicV1({
      participants: participants(4),
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const semifinalA = built.rounds.find((m) => m.round === 1 && m.slot === 1)!
    const semifinalB = built.rounds.find((m) => m.round === 1 && m.slot === 2)!
    const cat = category({ structure: built, participantCount: 4 })
    const ctx = buildSlotContext(cat, {
      boutsReleased: true,
      scheduleDisplayByBoutId: new Map([
        [`cat::${semifinalA.id}`, '1-1'],
        [`cat::${semifinalB.id}`, '1-2'],
      ]),
    })
    const final = built.rounds.find((m) => m.round === 2)!
    const slotA = resolveMatchSlot(ctx, final, 'A')
    const slotB = resolveMatchSlot(ctx, final, 'B')
    expect(isBlankSlot(slotA)).toBe(true)
    expect(isBlankSlot(slotB)).toBe(true)
    if (isBlankSlot(slotA)) {
      expect(slotA.hintLabel).toBe('Победитель боя 1-1')
    }
    if (isBlankSlot(slotB)) {
      expect(slotB.hintLabel).toBe('Победитель боя 1-2')
    }
  })

  it('semifinal finished → final slot has winner athlete', () => {
    const built = buildOlympicV1({
      participants: participants(4),
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const sf = built.rounds.find((m) => m.round === 1 && m.slot === 1)!
    const updatedRounds = built.rounds.map((m) =>
      m.id === sf.id ? { ...m, winnerEntryId: 'e1', loserEntryId: 'e4' } : m,
    )
    const cat = category({
      structure: { ...built, rounds: updatedRounds },
      boutOutcomes: {
        [sf.id]: {
          winnerEntryId: 'e1',
          loserEntryId: 'e4',
          victoryMethod: null,
          mainRedScore: 5,
          mainBlueScore: 0,
        },
      },
    })
    const ctx = buildSlotContext(cat)
    const final = updatedRounds.find((m) => m.round === 2)!
    const slotA = resolveMatchSlot(ctx, final, 'A')
    expect(isAthleteSlot(slotA)).toBe(true)
    if (isAthleteSlot(slotA)) {
      expect(slotA.entryId).toBe('e1')
    }
  })

  it('3-way bout1 finished → winner in final path and loser in bout2', () => {
    const built = buildThreeWayV1({ participants: participants(3), drawSeed: 's', options: {} })
    const bout1 = built.rounds.find((m) => m.round === 1)!
    const updated = built.rounds.map((m) =>
      m.id === bout1.id ? { ...m, winnerEntryId: 'e1', loserEntryId: 'e2' } : m,
    )
    const cat = category({
      effectiveSystemId: 'three_way',
      participantCount: 3,
      structure: { ...built, rounds: updated },
      participants: participants(3),
      boutOutcomes: {
        [bout1.id]: {
          winnerEntryId: 'e1',
          loserEntryId: 'e2',
          victoryMethod: null,
          mainRedScore: 3,
          mainBlueScore: 1,
        },
      },
    })
    const ctx = buildSlotContext(cat)
    const bout2 = updated.find((m) => m.round === 2)!
    const final = updated.find((m) => m.round === 3)!
    expect(isAthleteSlot(resolveWinnerAdvance(ctx, bout1))).toBe(true)
    expect(isAthleteSlot(resolveMatchSlot(ctx, bout2, 'A'))).toBe(true)
    expect(isAthleteSlot(resolveMatchSlot(ctx, final, 'A'))).toBe(true)
  })

  it('bronze ONE: both semifinals finished → losers in bronze bout', () => {
    const built = buildOlympicV1({
      participants: participants(4),
      drawSeed: 'seed',
      options: { bronzeMode: 'ONE' },
    })
    const sfMatches = built.rounds.filter((m) => m.round === 1)
    const updatedRounds = built.rounds.map((m) => {
      if (m.id === sfMatches[0]?.id) return { ...m, winnerEntryId: 'e1', loserEntryId: 'e4' }
      if (m.id === sfMatches[1]?.id) return { ...m, winnerEntryId: 'e2', loserEntryId: 'e3' }
      return m
    })
    const cat = category({
      structure: { ...built, rounds: updatedRounds },
      boutOutcomes: {
        [sfMatches[0]!.id]: {
          winnerEntryId: 'e1',
          loserEntryId: 'e4',
          victoryMethod: null,
          mainRedScore: 1,
          mainBlueScore: 0,
        },
        [sfMatches[1]!.id]: {
          winnerEntryId: 'e2',
          loserEntryId: 'e3',
          victoryMethod: null,
          mainRedScore: 2,
          mainBlueScore: 0,
        },
      },
    })
    const ctx = buildSlotContext(cat)
    const bronzeSlot = cat.structure.bronzeSlots?.[0]
    const pseudo = {
      id: bronzeSlot?.id ?? 'bronze',
      round: 0,
      slot: 1,
      matchNumber: 4,
      participantA: null,
      participantB: null,
      slotSourceA: bronzeSlot?.sourceA,
      slotSourceB: bronzeSlot?.sourceB,
    }
    expect(isAthleteSlot(resolveMatchSlot(ctx, pseudo, 'A'))).toBe(true)
    expect(isAthleteSlot(resolveMatchSlot(ctx, pseudo, 'B'))).toBe(true)
  })
})
