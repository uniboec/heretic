import { describe, expect, it } from 'vitest'
import { toTournamentInstant } from '../../datetime/tournament'
import { TOURNAMENT_TIMEZONE } from '../../config/tournament'

describe('toTournamentInstant', () => {
  it('builds instant from event date and HH:mm in tournament timezone', () => {
    const instant = toTournamentInstant({
      eventDate: '2026-10-03',
      localTime: '10:06:42',
      timeZone: TOURNAMENT_TIMEZONE,
    })
    expect(instant.toISOString()).toBe('2026-10-03T05:06:42.000Z')
  })
})
