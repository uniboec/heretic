import { describe, expect, it } from 'vitest'
import {
  buildDisciplinaryCards,
  disciplinaryCardColor,
} from '../disciplinaryCard'

describe('disciplinaryCard', () => {
  it('maps second warning to yellow and disqualification to red', () => {
    expect(disciplinaryCardColor('WARNING_1')).toBeNull()
    expect(disciplinaryCardColor('WARNING_2')).toBe('yellow')
    expect(disciplinaryCardColor('DISQUALIFICATION')).toBe('red')
  })

  it('builds separate cards for general and out-of-bounds ladders', () => {
    expect(
      buildDisciplinaryCards({
        general: 'WARNING_2',
        outOfBounds: 'DISQUALIFICATION',
      }),
    ).toEqual([
      {
        color: 'yellow',
        sourceLabel: 'Нарушение',
        sanctionLabel: 'Второе предупреждение',
      },
      {
        color: 'red',
        sourceLabel: 'Выход за ковёр',
        sanctionLabel: 'Дисквалификация',
      },
    ])
  })
})
