import { describe, expect, it } from 'vitest'
import { validateRegistrationEdit } from '../editRules'
import type { EntryPaymentStatus } from '../status'

describe('validateRegistrationEdit debt lock', () => {
  it('prevents removing a DEBT category', () => {
    expect(() =>
      validateRegistrationEdit(
        [
          {
            id: 'athlete-1',
            lastName: 'Иванов',
            firstName: 'Иван',
            middleName: null,
            birthDate: new Date('2012-01-01'),
            gender: 'male',
            entries: [
              {
                id: 'entry-1',
                discipline: 'tactic_control',
                ageDivisionId: 'm_juniors_1',
                weightCategoryId: 'm_w_66',
                experienceLevel: 'novice',
                paymentStatus: 'DEBT' as EntryPaymentStatus,
              },
            ],
          },
        ],
        {
          phone: '',
          email: '',
          athletes: [
            {
              athleteId: 'athlete-1',
              lastName: 'Иванов',
              firstName: 'Иван',
              middleName: '',
              birthDate: '2012-01-01',
              gender: 'male',
              rank: 'none',
              disciplineEntries: [],
            },
          ],
          consentPersonalData: true,
          consentPublication: true,
        },
      ),
    ).toThrow(/нельзя удалить/i)
  })
})
