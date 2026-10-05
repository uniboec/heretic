import type { BracketParticipantInput } from '../../../core/types'
import { buildThreeWayV1 } from './build'

function participant(
  seedPosition: number,
  entryId = `e${seedPosition}`,
): BracketParticipantInput {
  return {
    entryId,
    displayName: `Участник ${seedPosition}`,
    clubName: `Клуб ${seedPosition}`,
    city: 'Город',
    clubIdentity: `club-${seedPosition}`,
    publicNumber: 100 + seedPosition,
    seedPosition,
    seedLocked: false,
  }
}

export const threeWayV1Fixtures = {
  threeParticipants: () =>
    buildThreeWayV1({
      participants: [participant(1), participant(2), participant(3)],
      drawSeed: 'fixture-seed',
      options: { bronzeMode: null },
    }),
}
