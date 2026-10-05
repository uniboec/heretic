import type { BracketParticipantInput, BracketRoundMatch } from '../core/types'
import type { BracketExportParticipant } from './types'

export function formatParticipantMeta(clubName?: string, city?: string): string | null {
  const parts = [clubName?.trim(), city?.trim()].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export function resolveMatchParticipants(
  match: BracketRoundMatch,
  byEntry: Map<string, BracketExportParticipant>,
): {
  participantA: BracketExportParticipant | null
  participantB: BracketExportParticipant | null
} {
  const resolveOne = (input: BracketParticipantInput | null): BracketExportParticipant | null => {
    if (!input) return null
    return (
      byEntry.get(input.entryId) ?? {
        entryId: input.entryId,
        displayName: input.displayName ?? '—',
        clubName: input.clubName ?? '',
        city: input.city,
        seedPosition: input.seedPosition ?? 0,
      }
    )
  }

  return {
    participantA: resolveOne(match.participantA),
    participantB: resolveOne(match.participantB),
  }
}

export function resolveParticipantLine(
  participant: BracketExportParticipant | null,
  pendingLabel?: string,
): string {
  if (participant) {
    const meta = formatParticipantMeta(participant.clubName, participant.city)
    const seed = participant.seedPosition > 0 ? `[${participant.seedPosition}] ` : ''
    return `${seed}${participant.displayName}${meta ? ` · ${meta}` : ''}`
  }
  return pendingLabel ?? 'Пропуск'
}

export function buildParticipantMap(
  participants: BracketExportParticipant[],
): Map<string, BracketExportParticipant> {
  return new Map(participants.map((p) => [p.entryId, p]))
}
