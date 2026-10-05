/** Stable fingerprint from unique sorted category keys (not raw entry rows). */
export function computeCategoryFingerprint(categoryKeys: string[]): string {
  const unique = [...new Set(categoryKeys.filter(Boolean))].sort()
  return unique.join('|')
}

export function isManualWeightFingerprintCurrent(
  storedFingerprint: string | null | undefined,
  currentCategoryKeys: string[],
): boolean {
  if (!storedFingerprint) return false
  return storedFingerprint === computeCategoryFingerprint(currentCategoryKeys)
}
