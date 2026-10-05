import { roundRobinV1 } from './index'

export const roundRobinV1Fixtures = {
  fourParticipants: () => {
    const participants = Array.from({ length: 4 }, (_, i) => ({
      entryId: `e${i + 1}`,
      displayName: `Athlete ${i + 1}`,
      clubName: 'Club',
      city: 'City',
      clubIdentity: 'Club::City',
      publicNumber: i + 1,
      seedPosition: i + 1,
      seedLocked: false,
    }))
    return roundRobinV1.build({
      participants,
      drawSeed: 'fixture-seed',
      options: { bronzeMode: null },
    })
  },
}
