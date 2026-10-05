import type { BracketParticipantInput, EligibleEntry } from '../types'

export function toBracketParticipantInput(
  participant: { entryId: string; seedPosition: number; seedLocked: boolean },
  eligible: EligibleEntry | undefined,
  fallback?: { displayName?: string | null; clubName?: string | null; city?: string | null; publicNumber?: number | null },
): BracketParticipantInput {
  const clubName = eligible?.clubName ?? fallback?.clubName ?? ''
  const city = eligible?.city ?? fallback?.city ?? ''
  return {
    entryId: participant.entryId,
    displayName: eligible?.displayName ?? fallback?.displayName ?? participant.entryId,
    clubName,
    city,
    clubIdentity: eligible?.clubIdentity ?? `${clubName}::${city}`,
    publicNumber: eligible?.publicNumber ?? fallback?.publicNumber ?? null,
    seedPosition: participant.seedPosition,
    seedLocked: participant.seedLocked,
    strengthTier: eligible?.strengthTier ?? null,
    clubKey: eligible?.clubKey ?? null,
    cityKey: eligible?.cityKey ?? null,
  }
}
