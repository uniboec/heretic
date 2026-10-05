import { describe, expect, it } from 'vitest'
import { TeamRankingSettingsPatchSchema } from '../schemas'

describe('TeamRankingSettingsPatchSchema', () => {
  it('requires solo points for CUSTOM mode', () => {
    const result = TeamRankingSettingsPatchSchema.safeParse({
      firstPlacePoints: 5,
      secondPlacePoints: 3,
      thirdPlacePoints: 2,
      soloParticipantPointsMode: 'CUSTOM',
    })

    expect(result.success).toBe(false)
  })

  it('accepts CUSTOM mode with solo points', () => {
    const result = TeamRankingSettingsPatchSchema.safeParse({
      firstPlacePoints: 5,
      secondPlacePoints: 3,
      thirdPlacePoints: 2,
      soloParticipantPointsMode: 'CUSTOM',
      soloParticipantFirstPlacePoints: 1,
    })

    expect(result.success).toBe(true)
  })

  it('allows null solo points for STANDARD mode', () => {
    const result = TeamRankingSettingsPatchSchema.safeParse({
      firstPlacePoints: 5,
      secondPlacePoints: 3,
      thirdPlacePoints: 2,
      soloParticipantPointsMode: 'STANDARD',
      soloParticipantFirstPlacePoints: null,
    })

    expect(result.success).toBe(true)
  })
})
