import { describe, expect, it } from 'vitest'
import { buildBoutPaperBlock, boutPaperBlockToPlainText } from '../formatBoutPaperBlock'
import type { BracketExportParticipant } from '../types'

const byEntry = new Map<string, BracketExportParticipant>([
  [
    'a',
    { entryId: 'a', seedPosition: 1, displayName: 'Иванов Иван', clubName: 'Клуб A', city: 'Город' },
  ],
  [
    'b',
    { entryId: 'b', seedPosition: 2, displayName: 'Петров Пётр', clubName: 'Клуб B', city: 'Город' },
  ],
])

describe('formatBoutPaperBlock', () => {
  it('renders blank lines for unfinished bout', () => {
    const block = buildBoutPaperBlock({
      match: {
        id: 'm1',
        round: 1,
        slot: 1,
        matchNumber: 17,
        participantA: { entryId: 'a' } as never,
        participantB: { entryId: 'b' } as never,
      },
      byEntry,
      boutOutcomes: {},
    })

    const text = boutPaperBlockToPlainText(block)
    expect(text).toContain('Бой 17')
    expect(text).toContain('Иванов Иван')
    expect(text).toContain('Результат: __________________')
    expect(text).toContain('Победитель: __________________')
  })

  it('marks winner and score for finished bout', () => {
    const block = buildBoutPaperBlock({
      match: {
        id: 'm1',
        round: 1,
        slot: 1,
        matchNumber: 17,
        participantA: { entryId: 'a' } as never,
        participantB: { entryId: 'b' } as never,
        winnerEntryId: 'a',
      },
      byEntry,
      boutOutcomes: {
        m1: {
          winnerEntryId: 'a',
          loserEntryId: 'b',
          victoryMethod: 'POINTS',
          mainRedScore: 5,
          mainBlueScore: 2,
        },
      },
    })

    const text = boutPaperBlockToPlainText(block)
    expect(text).toContain('Иванов Иван · Клуб A · Город ✓')
    expect(text).toContain('Результат: 5:2')
    expect(text).not.toContain('Победитель:')
  })
})
