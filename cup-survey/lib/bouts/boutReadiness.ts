export type BoutSideKind = 'athlete' | 'hint' | 'bye' | (string & {})

export function boutHasBothAthletes(
  sideA: { kind: BoutSideKind },
  sideB: { kind: BoutSideKind },
): boolean {
  return sideA.kind === 'athlete' && sideB.kind === 'athlete'
}

export function bracketMatchHasBothAthletes(match: {
  participantA?: { entryId: string } | null
  participantB?: { entryId: string } | null
}): boolean {
  return Boolean(match.participantA?.entryId && match.participantB?.entryId)
}
