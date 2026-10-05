/** Minimum participants for olympic bronze mode (ONE/TWO). */
export const OLYMPIC_BRONZE_MIN_PARTICIPANTS = 4

/** Static system limits for UI and format-rule validation (works on client without registry). */
export const BRACKET_SYSTEM_META = {
  champion: { maxParticipants: 1, exactParticipants: 1, supportsBouts: false },
  olympic: { maxParticipants: 32, supportsBouts: true },
  round_robin: { maxParticipants: 32, supportsBouts: true },
  three_way: { maxParticipants: 3, exactParticipants: 3, supportsBouts: true },
} as const

export type BracketSystemId = keyof typeof BRACKET_SYSTEM_META

export const BRACKET_SYSTEM_IDS = Object.keys(BRACKET_SYSTEM_META) as BracketSystemId[]

export function systemSupportsBouts(systemId: string | null | undefined): boolean {
  if (!systemId) return false
  const meta = BRACKET_SYSTEM_META[systemId as BracketSystemId]
  return meta?.supportsBouts ?? false
}
