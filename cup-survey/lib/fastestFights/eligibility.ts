import type { VictoryMethod } from '@/lib/config/fseRules'

export const FASTEST_FIGHT_VICTORY_METHODS = [
  'SUBMISSION',
  'CHOKE',
  'CLEAR_ADVANTAGE',
] as const satisfies readonly VictoryMethod[]

export type FastestFightVictoryMethod = (typeof FASTEST_FIGHT_VICTORY_METHODS)[number]

export function isFastestFightEligible(victoryMethod: string): boolean {
  return FASTEST_FIGHT_VICTORY_METHODS.includes(victoryMethod as FastestFightVictoryMethod)
}

/** Sub-second API/script timings must not appear as 0:00 in the public ranking. */
export const MIN_FASTEST_FIGHT_ELAPSED_MS = 1000

export function isFastestFightRankingEligible(input: {
  victoryMethod: string
  boutElapsedMs: number
  fightOfficiallyStarted: boolean
}): boolean {
  return (
    isFastestFightEligible(input.victoryMethod) &&
    input.fightOfficiallyStarted &&
    input.boutElapsedMs >= MIN_FASTEST_FIGHT_ELAPSED_MS
  )
}
