import { describe, expect, it } from 'vitest'

import { collectEntryMandateWarningAthletes } from '../boutMandateWarnings'

describe('collectEntryMandateWarningAthletes', () => {
  it('returns only corners with mandate warnings', () => {
    const athletes = collectEntryMandateWarningAthletes(
      [
        {
          corner: 'red',
          side: {
            kind: 'athlete',
            entryId: 'entry-red',
            displayName: 'Иванов Иван',
            clubName: 'Клуб',
            city: 'Город',
          },
        },
        {
          corner: 'blue',
          side: {
            kind: 'athlete',
            entryId: 'entry-blue',
            displayName: 'Петров Пётр',
            clubName: 'Клуб 2',
            city: 'Город 2',
          },
        },
      ],
      {
        'entry-red': [{ code: 'MEDICAL_UNCHECKED', message: 'Нет мед. справки' }],
        'entry-blue': [],
      },
      {
        'entry-red': 'athlete-red',
        'entry-blue': 'athlete-blue',
      },
    )

    expect(athletes).toEqual([
      {
        corner: 'red',
        name: 'Иванов Иван',
        entryId: 'entry-red',
        athleteId: 'athlete-red',
        warnings: [{ code: 'MEDICAL_UNCHECKED', message: 'Нет мед. справки' }],
      },
    ])
  })
})
