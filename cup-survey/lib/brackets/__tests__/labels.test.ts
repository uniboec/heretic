import { describe, expect, it } from 'vitest'
import {
  formatParticipantCount,
  formatPublicBracketCategoryMeta,
  formatPublicSystemLabel,
  formatSystemLabel,
} from '../labels'

describe('formatParticipantCount', () => {
  it('uses singular for 1, 21, 101', () => {
    expect(formatParticipantCount(1)).toBe('1 участник')
    expect(formatParticipantCount(21)).toBe('21 участник')
    expect(formatParticipantCount(101)).toBe('101 участник')
  })

  it('uses genitive plural for 2-4 and 22-24', () => {
    expect(formatParticipantCount(2)).toBe('2 участника')
    expect(formatParticipantCount(4)).toBe('4 участника')
    expect(formatParticipantCount(22)).toBe('22 участника')
  })

  it('uses plural for 0, 5-20, 11-14', () => {
    expect(formatParticipantCount(0)).toBe('0 участников')
    expect(formatParticipantCount(5)).toBe('5 участников')
    expect(formatParticipantCount(11)).toBe('11 участников')
    expect(formatParticipantCount(14)).toBe('14 участников')
  })
})

describe('formatPublicSystemLabel', () => {
  it('adds «система» for olympic and round_robin on public pages', () => {
    expect(formatPublicSystemLabel('olympic')).toBe('Олимпийская система')
    expect(formatPublicSystemLabel('round_robin')).toBe('Круговая система')
  })

  it('keeps short labels for other systems', () => {
    expect(formatPublicSystemLabel('champion')).toBe('Чемпион')
    expect(formatPublicSystemLabel('three_way')).toBe('Тройка с возвратом')
  })

  it('does not change admin labels', () => {
    expect(formatSystemLabel('olympic')).toBe('Олимпийская')
    expect(formatSystemLabel('round_robin')).toBe('Круговая')
  })
})

describe('formatPublicBracketCategoryMeta', () => {
  it('uses public system labels in category meta', () => {
    expect(formatPublicBracketCategoryMeta(2, 'olympic')).toBe('2 участника · Олимпийская система')
    expect(formatPublicBracketCategoryMeta(3, 'round_robin')).toBe('3 участника · Круговая система')
  })
})
