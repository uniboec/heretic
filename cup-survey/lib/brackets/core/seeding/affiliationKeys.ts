function normalize(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

export function resolveClubKey(
  clubId: string | null | undefined,
  clubName: string | null | undefined,
  city: string | null | undefined,
): string | null {
  if (clubId) return `id:${clubId}`
  const normalizedClub = normalize(clubName)
  if (normalizedClub) {
    const normalizedCity = normalize(city) ?? 'unknown'
    return `name:${normalizedClub}::city:${normalizedCity}`
  }
  return null
}

export function resolveCityKey(city: string | null | undefined): string | null {
  return normalize(city)
}
