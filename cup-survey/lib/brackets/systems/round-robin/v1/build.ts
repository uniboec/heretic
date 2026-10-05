import type { BracketStructure, SystemBuildInput } from '../../../core/types'

/** Circle method round-robin scheduling. */
export function buildRoundRobinV1(input: SystemBuildInput): BracketStructure {
  const ids = input.participants
    .sort((a, b) => a.seedPosition - b.seedPosition)
    .map((p) => p.entryId)

  const n = ids.length
  const pairs: Array<{
    entryIdA: string
    entryIdB: string
    round: number
    matchNumber: number
  }> = []
  let matchNumber = 0

  if (n < 2) {
    return { systemId: 'round_robin', systemVersion: 1, rounds: [], roundRobinPairs: [] }
  }

  const list = [...ids]
  if (n % 2 === 1) list.push('__BYE__')

  const count = list.length
  const rounds = count - 1

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < count / 2; i++) {
      const a = list[i]
      const b = list[count - 1 - i]
      if (a !== '__BYE__' && b !== '__BYE__') {
        matchNumber += 1
        pairs.push({ entryIdA: a, entryIdB: b, round: r + 1, matchNumber })
      }
    }
    const fixed = list[0]
    const rest = list.slice(1)
    rest.unshift(rest.pop()!)
    list.splice(0, list.length, fixed, ...rest)
  }

  return {
    systemId: 'round_robin',
    systemVersion: 1,
    rounds: [],
    roundRobinPairs: pairs,
  }
}

export function validateRoundRobinCategory(n: number) {
  const issues = []
  if (n < 2) issues.push({ code: 'TOO_FEW', message: 'Нужно минимум 2 участника' })
  if (n > 32) {
    issues.push({ code: 'EXCEEDS_MAX', message: 'Круговая система поддерживает максимум 32 участника' })
  }
  return issues
}
