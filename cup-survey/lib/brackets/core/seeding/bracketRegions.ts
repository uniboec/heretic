import { bracketSizeForN, seedOrderForBracketSize } from './clubSeparation'

export interface BracketRegion {
  half: number
  quarter: number
  eighth: number
  firstRoundPair: number
}

function slotForSeedPosition(seedPosition: number, bracketSize: number): number {
  const order = seedOrderForBracketSize(bracketSize)
  const slot = order.indexOf(seedPosition)
  return slot >= 0 ? slot : 0
}

export function earliestMeetingRound(
  seedPosA: number,
  seedPosB: number,
  bracketSize: number,
): number {
  const slotA = slotForSeedPosition(seedPosA, bracketSize)
  const slotB = slotForSeedPosition(seedPosB, bracketSize)
  const maxRound = Math.log2(bracketSize)
  for (let round = 1; round <= maxRound; round++) {
    const groupSize = 2 ** round
    const groupA = Math.floor(slotA / groupSize)
    const groupB = Math.floor(slotB / groupSize)
    if (groupA === groupB) return round
  }
  return maxRound
}

export function idealEarliestRound(bracketSize: number, groupSize: number): number {
  if (groupSize <= 1) return Math.log2(bracketSize)
  const ideal = Math.log2(bracketSize / groupSize)
  return Math.max(1, ideal)
}

export function getBracketRegion(seedPosition: number, bracketSize: number): BracketRegion {
  const slot = slotForSeedPosition(seedPosition, bracketSize)
  const halfSize = bracketSize / 2
  const quarterSize = bracketSize / 4
  const eighthSize = bracketSize / 8
  const half = Math.floor(slot / halfSize) + 1
  const quarter = Math.floor(slot / quarterSize) + 1
  const eighth = bracketSize >= 8 ? Math.floor(slot / eighthSize) + 1 : 1
  const firstRoundPair = Math.floor(slot / 2) + 1
  return { half, quarter, eighth, firstRoundPair }
}

export function formatRoundLabel(bracketSize: number, meetingRound: number): string {
  const remaining = bracketSize / 2 ** meetingRound
  if (remaining <= 1) return 'Финал'
  if (remaining === 2) return '1/2'
  if (remaining === 4) return '1/4'
  if (remaining === 8) return '1/8'
  if (remaining === 16) return '1/16'
  return `1/${remaining}`
}

export function bracketSizeForParticipantCount(n: number): number {
  return bracketSizeForN(n)
}
