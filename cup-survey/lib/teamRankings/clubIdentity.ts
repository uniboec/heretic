export function buildClubIdentity(clubName: string, city: string): string {
  return `${clubName}::${city}`
}

/** Athletes without a club name are excluded from team rankings. */
export function isRankableClub(clubName: string): boolean {
  return clubName.trim().length > 0
}

export function parseClubIdentity(clubIdentity: string): { clubName: string; city: string } {
  const separatorIndex = clubIdentity.indexOf('::')
  if (separatorIndex < 0) {
    return { clubName: clubIdentity, city: '' }
  }
  return {
    clubName: clubIdentity.slice(0, separatorIndex),
    city: clubIdentity.slice(separatorIndex + 2),
  }
}
