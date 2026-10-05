import { describe, expect, it } from 'vitest'
import {
  formatPostponeSkipLabel,
  getMaxPostponeSkip,
  listRunnableMatBoutIds,
  resolvePostponeAnchorId,
} from '../resolvePostponeAnchor'

const matBoutIds = ['a', 'b', 'c', 'd']

describe('resolvePostponeAnchor', () => {
  it('resolves anchor by skip count', () => {
    expect(resolvePostponeAnchorId(matBoutIds, 'a', 1)).toBe('b')
    expect(resolvePostponeAnchorId(matBoutIds, 'a', 2)).toBe('c')
    expect(resolvePostponeAnchorId(matBoutIds, 'a', 3)).toBe('d')
  })

  it('returns max skip for current bout', () => {
    expect(getMaxPostponeSkip(matBoutIds, 'a')).toBe(3)
    expect(getMaxPostponeSkip(matBoutIds, 'd')).toBe(0)
  })

  it('skips completed bouts when resolving postpone anchor', () => {
    const completed = new Set(['b'])
    const runnable = listRunnableMatBoutIds(matBoutIds, completed)
    expect(runnable).toEqual(['a', 'c', 'd'])
    expect(resolvePostponeAnchorId(runnable, 'a', 1)).toBe('c')
  })

  it('skips cascade bouts when counting postpone distance', () => {
    const cascade = new Set(['a', 'b'])
    expect(getMaxPostponeSkip(matBoutIds, 'a', cascade)).toBe(2)
    expect(resolvePostponeAnchorId(matBoutIds, 'a', 1, cascade)).toBe('c')
    expect(resolvePostponeAnchorId(matBoutIds, 'a', 2, cascade)).toBe('d')
  })

  it('formats skip labels in Russian', () => {
    expect(formatPostponeSkipLabel(1)).toBe('1 поединок')
    expect(formatPostponeSkipLabel(2)).toBe('2 поединка')
    expect(formatPostponeSkipLabel(5)).toBe('5 поединков')
    expect(formatPostponeSkipLabel(11)).toBe('11 поединков')
  })
})
