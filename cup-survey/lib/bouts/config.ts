/** Phase 2: /bouts reads boutsReleased instead of visible. */
export function isIndependentBoutsReleaseEnabled(): boolean {
  const value = process.env.INDEPENDENT_BOUTS_RELEASE
  return value === 'true' || value === '1'
}
