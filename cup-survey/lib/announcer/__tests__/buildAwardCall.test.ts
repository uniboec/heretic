import { describe, expect, it } from 'vitest'
import { buildAwardCallText } from '../text/buildAwardCall'
import { testAnnouncerRule } from './fixtures'

const basePayload = {
  queueId: 'queue-1',
  categoryTitle: 'Тактик Контрол · Новички · 10–11 лет · до 29 кг',
  placements: [
    { placement: 1, displayName: 'Иванов Иван', clubName: 'Клуб А' },
    { placement: 2, displayName: 'Петров Пётр', clubName: 'Клуб Б' },
  ],
}

describe('buildAwardCallText', () => {
  it('builds repeat category invitation text', () => {
    const text = buildAwardCallText(
      { ...basePayload, repeatCategory: true },
      testAnnouncerRule(),
      'приглашаются',
    )
    expect(text).toContain('Повторно')
    expect(text).toContain('Иванов Иван')
    expect(text).toContain('Петров Пётр')
  })

  it('builds repeat prepare text', () => {
    const text = buildAwardCallText(
      { ...basePayload, repeatCategory: true },
      testAnnouncerRule(),
      'готовятся',
    )
    expect(text).toContain('Повторно')
    expect(text).toContain('готовятся')
  })

  it('builds repeat single placement invitation text', () => {
    const text = buildAwardCallText(
      {
        ...basePayload,
        repeatPlacementId: 'placement-2',
        repeatPlacement: {
          placement: 2,
          displayName: 'Петров Пётр',
          clubName: 'Клуб Б',
          placementId: 'placement-2',
        },
      },
      testAnnouncerRule(),
      'приглашаются',
    )
    expect(text).toContain('Повторно на награждение приглашается')
    expect(text).toContain('Второе место')
    expect(text).toContain('Петров Пётр')
    expect(text).not.toContain('Иванов Иван')
  })
})
