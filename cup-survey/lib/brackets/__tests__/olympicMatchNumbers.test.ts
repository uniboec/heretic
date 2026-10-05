import { describe, expect, it } from 'vitest'
import {
  getOlympicBronzeBoutNumber,
  getOlympicGlobalBoutNumber,
  getOlympicSemifinalBoutNumbers,
  getOlympicWinnerBracketBoutCount,
} from '../systems/olympic/matchNumbers'
import { olympicV1 } from '../systems/olympic/v1'
import '../systems'

function buildN(n: number) {
  const participants = Array.from({ length: n }, (_, i) => ({
    entryId: `e${i + 1}`,
    displayName: `Athlete ${i + 1}`,
    clubName: `Club ${(i % 4) + 1}`,
    city: 'City',
    clubIdentity: `Club ${(i % 4) + 1}::City`,
    publicNumber: i + 1,
    seedPosition: i + 1,
    seedLocked: false,
  }))
  return olympicV1.build({
    participants,
    drawSeed: 'test',
    options: { bronzeMode: n >= 4 ? 'ONE' : null },
  })
}

describe('getOlympicSemifinalBoutNumbers', () => {
  it('returns semifinal bout numbers for 8- and 16-person brackets', () => {
    expect(getOlympicSemifinalBoutNumbers(8)).toEqual([5, 6])
    expect(getOlympicSemifinalBoutNumbers(16)).toEqual([13, 14])
  })
})

describe('getOlympicGlobalBoutNumber', () => {
  it('numbers 8-person bracket bouts 1–7', () => {
    expect(getOlympicGlobalBoutNumber(8, 1, 1)).toBe(1)
    expect(getOlympicGlobalBoutNumber(8, 1, 4)).toBe(4)
    expect(getOlympicGlobalBoutNumber(8, 2, 1)).toBe(5)
    expect(getOlympicGlobalBoutNumber(8, 2, 2)).toBe(6)
    expect(getOlympicGlobalBoutNumber(8, 3, 1)).toBe(7)
  })

  it('numbers 16-person bracket quarterfinals as 9–12', () => {
    expect(getOlympicGlobalBoutNumber(16, 1, 8)).toBe(8)
    expect(getOlympicGlobalBoutNumber(16, 2, 1)).toBe(9)
    expect(getOlympicGlobalBoutNumber(16, 2, 4)).toBe(12)
    expect(getOlympicGlobalBoutNumber(16, 4, 1)).toBe(15)
  })
})

describe('olympic build match labels', () => {
  it('assigns sequential bout numbers for N=4', () => {
    const structure = buildN(4)
    const byRound = (r: number) => structure.rounds.filter((m) => m.round === r)

    expect(byRound(1).map((m) => m.matchNumber)).toEqual([1, 2])
    expect(byRound(1).map((m) => m.label)).toEqual(['Бой 1', 'Бой 2'])
    expect(byRound(2)[0].matchNumber).toBe(3)
    expect(byRound(2)[0].label).toBeUndefined()
    expect(getOlympicWinnerBracketBoutCount(4)).toBe(3)
    expect(getOlympicBronzeBoutNumber(4)).toBe(4)
    expect(structure.bronzeSlots?.[0].label).toContain('(4)')
    expect(structure.bronzeSlots?.[0].hintA).toBe('Проигравший боя 1')
    expect(structure.bronzeSlots?.[0].hintB).toBe('Проигравший боя 2')
  })

  it('assigns sequential bout numbers for N=8', () => {
    const structure = buildN(8)
    const numbers = structure.rounds.map((m) => m.matchNumber)
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7])

    const semifinals = structure.rounds.filter((m) => m.round === 2)
    expect(semifinals.map((m) => m.label)).toEqual(['Бой 5', 'Бой 6'])
  })

  it('assigns sequential bout numbers for N=16', () => {
    const structure = buildN(16)
    expect(structure.rounds.map((m) => m.matchNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ])
  })

  it('uses stable bout-based ids', () => {
    const structure = buildN(8)
    expect(structure.rounds.find((m) => m.matchNumber === 5)?.id).toBe('bout-5')
  })

  it('places athletes only in round 1 without auto-advancement', () => {
    const structure = buildN(8)

    for (const match of structure.rounds.filter((m) => m.round === 1)) {
      expect(match.participantA ?? match.participantB).not.toBeNull()
    }

    for (const match of structure.rounds.filter((m) => m.round > 1)) {
      expect(match.participantA).toBeNull()
      expect(match.participantB).toBeNull()
      expect(match.slotHintA).toMatch(/^Победитель боя \d+$/)
      expect(match.slotHintB).toMatch(/^Победитель боя \d+$/)
    }

    const semifinal = structure.rounds.find((m) => m.matchNumber === 5)!
    expect(semifinal.slotHintA).toBe('Победитель боя 1')
    expect(semifinal.slotHintB).toBe('Победитель боя 2')

    const final = structure.rounds.find((m) => m.matchNumber === 7)!
    expect(final.slotHintA).toBe('Победитель боя 5')
    expect(final.slotHintB).toBe('Победитель боя 6')
  })
})
