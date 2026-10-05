import { describe, expect, it } from 'vitest'
import {
  resolveBracketMatchBadgeLabel,
  resolveBracketMatchLabel,
} from '../scheduleBoutLabel'

describe('scheduleBoutLabel', () => {
  const scheduleDisplayByBoutId = new Map([['cat-a::bout-2', '1-21']])

  it('resolves public match label from schedule display number', () => {
    expect(
      resolveBracketMatchLabel({
        categoryKey: 'cat-a',
        matchId: 'bout-2',
        matchNumber: 2,
        scheduleDisplayByBoutId,
      }),
    ).toBe('Бой 1-21')
  })

  it('resolves print badge label from schedule display number', () => {
    expect(
      resolveBracketMatchBadgeLabel({
        categoryKey: 'cat-a',
        matchId: 'bout-2',
        matchNumber: 2,
        scheduleDisplayByBoutId,
      }),
    ).toBe('Бой №1-21')
  })

  it('replaces stale internal labels with schedule display numbers', () => {
    expect(
      resolveBracketMatchLabel({
        categoryKey: 'cat-a',
        matchId: 'bout-2',
        label: 'Бой 2',
        matchNumber: 2,
        scheduleDisplayByBoutId,
      }),
    ).toBe('Бой 1-21')
  })

  it('keeps semantic labels such as finals', () => {
    expect(
      resolveBracketMatchLabel({
        categoryKey: 'cat-a',
        matchId: 'bout-3',
        label: 'Финал · 1 место',
        matchNumber: 3,
        scheduleDisplayByBoutId: new Map([['cat-a::bout-3', '1-24']]),
      }),
    ).toBe('Финал · 1 место')
  })
})
