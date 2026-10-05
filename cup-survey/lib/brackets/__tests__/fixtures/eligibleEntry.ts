import type { EligibleEntry } from '../../core/types'

export function eligibleEntry(
  overrides: Partial<EligibleEntry> & Pick<EligibleEntry, 'entryId'>,
): EligibleEntry {
  return {
    sourceCategoryKey: 'a',
    effectiveCategoryKey: 'a',
    clubIdentity: 'c::City',
    displayName: 'Athlete',
    clubName: 'c',
    city: 'City',
    clubId: null,
    rankId: null,
    gender: 'male',
    strengthTier: null,
    clubKey: null,
    cityKey: null,
    publicNumber: 1,
    paymentStatus: 'PAID',
    ...overrides,
  }
}
