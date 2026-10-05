export interface AthleteNameParts {
  lastName: string
  firstName: string
  middleName?: string | null
}

export function formatAthleteFullName(parts: AthleteNameParts): string {
  return [parts.lastName.trim(), parts.firstName.trim(), parts.middleName?.trim()]
    .filter(Boolean)
    .join(' ')
}

export function athleteNameMatchesQuery(parts: AthleteNameParts, query: string): boolean {
  const haystack = formatAthleteFullName(parts).toLowerCase()
  return haystack.includes(query.toLowerCase())
}

export function participantSearchMatchesQuery(
  parts: AthleteNameParts,
  clubName: string,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return athleteNameMatchesQuery(parts, q) || clubName.toLowerCase().includes(q)
}

export function athleteIdentityKey(parts: AthleteNameParts, birthDate: string): string {
  return `${formatAthleteFullName(parts)}:${birthDate}`
}
