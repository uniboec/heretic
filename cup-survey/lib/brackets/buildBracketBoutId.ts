export function buildBracketBoutId(categoryKey: string, localMatchId: string): string {
  return `${categoryKey}::${localMatchId}`
}
