import { describe, expect, it } from 'vitest'
import {
  parseInternalAdvanceHintLabel,
  resolveBronzeFightTitle,
  resolveStaleAdvanceHintLabel,
} from '../scheduleHint'

describe('scheduleHint stale label resolution', () => {
  const scheduleDisplayByBoutId = new Map([
    ['cat::bout-2', '1-21'],
    ['cat::bronze-fight', '1-24'],
  ])

  it('parses internal winner and loser hints', () => {
    expect(parseInternalAdvanceHintLabel('Победитель боя 2')).toEqual({
      feederMatchId: 'bout-2',
      outcome: 'winner',
    })
    expect(parseInternalAdvanceHintLabel('Проигравший боя 2')).toEqual({
      feederMatchId: 'bout-2',
      outcome: 'loser',
    })
  })

  it('prefers schedule display numbers even when category is not released', () => {
    expect(
      resolveStaleAdvanceHintLabel({
        label: 'Победитель боя 2',
        categoryKey: 'cat',
        released: false,
        scheduleDisplayByBoutId,
      }),
    ).toBe('Победитель боя 1-21')
  })

  it('resolves stale advance hints from label text', () => {
    expect(
      resolveStaleAdvanceHintLabel({
        label: 'Победитель боя 2',
        categoryKey: 'cat',
        released: true,
        scheduleDisplayByBoutId,
      }),
    ).toBe('Победитель боя 1-21')
  })

  it('resolves bronze fight title from schedule display number', () => {
    expect(
      resolveBronzeFightTitle({
        matchId: 'bronze-fight',
        label: 'Бой за 3-е место (4)',
        categoryKey: 'cat',
        scheduleDisplayByBoutId,
      }),
    ).toBe('Бой за 3-е место (1-24)')
  })
})
