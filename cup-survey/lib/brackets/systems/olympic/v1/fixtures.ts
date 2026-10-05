import { olympicV1 } from './index'

export const olympicV1Fixtures = {
  eightParticipants: () => {
    const participants = Array.from({ length: 8 }, (_, i) => ({
      entryId: `e${i + 1}`,
      displayName: `Athlete ${i + 1}`,
      clubName: `Club ${(i % 3) + 1}`,
      city: 'City',
      clubIdentity: `Club ${(i % 3) + 1}::City`,
      publicNumber: i + 1,
      seedPosition: i + 1,
      seedLocked: false,
    }))
    return olympicV1.build({
      participants,
      drawSeed: 'fixture-seed',
      options: { bronzeMode: 'TWO' },
    })
  },
}
