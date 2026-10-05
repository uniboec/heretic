import type { BracketDrawParticipant } from '@prisma/client'
import type { BracketParticipantInput } from '../core/types'

export function toBracketParticipantInput(
  participant: BracketDrawParticipant,
): BracketParticipantInput {
  const clubName = participant.snapshotClubName ?? ''
  const city = participant.snapshotCity ?? ''
  return {
    entryId: participant.entryId,
    displayName: participant.snapshotDisplayName ?? participant.entryId,
    clubName,
    city,
    clubIdentity: `${clubName}::${city}`,
    publicNumber: participant.snapshotPublicNumber ?? null,
    seedPosition: participant.seedPosition,
    seedLocked: participant.seedLocked,
    strengthTier: null,
    clubKey: null,
    cityKey: null,
  }
}

export function findDrawParticipant(
  participants: BracketDrawParticipant[],
  entryId: string | null | undefined,
): BracketParticipantInput | null {
  if (!entryId) return null
  const row = participants.find((participant) => participant.entryId === entryId)
  return row ? toBracketParticipantInput(row) : null
}
