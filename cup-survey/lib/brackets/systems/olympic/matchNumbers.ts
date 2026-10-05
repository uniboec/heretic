import { formatOlympicBoutLabel } from '../../labels'

/**
 * Сквозная нумерация боёв в олимпийской сетке на выбывание.
 *
 * Общепринятая схема (протоколы, табло, печатные сетки):
 * - первый раунд: бои 1…B/2 (сверху вниз);
 * - каждый следующий раунд продолжает нумерацию;
 * - при B=8: 1/4 → 1–4, полуфинал → 5–6, финал → 7;
 * - бой за 3-е место (если есть) → B (т.е. сразу после B−1 боёв основной сетки).
 */
export function getOlympicGlobalBoutNumber(
  bracketSize: number,
  round: number,
  slotInRound: number,
): number {
  let offset = 0
  let matchesInRound = bracketSize / 2

  for (let r = 1; r < round; r++) {
    offset += matchesInRound
    matchesInRound /= 2
  }

  return offset + slotInRound
}

export function getOlympicWinnerBracketBoutCount(bracketSize: number): number {
  return bracketSize - 1
}

export function getOlympicBronzeBoutNumber(bracketSize: number): number {
  return bracketSize
}

/** Номера боёв полуфинала в олимпийской сетке (слоты 1 и 2). */
export function getOlympicSemifinalBoutNumbers(bracketSize: number): [number, number] {
  const semifinalRound = Math.log2(bracketSize) - 1
  return [
    getOlympicGlobalBoutNumber(bracketSize, semifinalRound, 1),
    getOlympicGlobalBoutNumber(bracketSize, semifinalRound, 2),
  ]
}

export function resolveOlympicMatchLabel(params: {
  boutNumber: number
  round: number
  maxRound: number
  matchesInRound: number
}): string | undefined {
  const { boutNumber, round, maxRound, matchesInRound } = params

  if (round === maxRound && matchesInRound === 1) {
    return undefined
  }

  return formatOlympicBoutLabel(boutNumber)
}
