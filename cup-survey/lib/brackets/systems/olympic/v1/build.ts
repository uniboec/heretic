import { bracketSizeForN, seedOrderForBracketSize } from '../../../core/seeding/clubSeparation'
import { formatBoutLoserHint, formatBoutWinnerHint } from '../../../labels'
import type {
  BracketParticipantInput,
  BracketRoundMatch,
  BracketStructure,
  SystemBuildInput,
  SystemOptions,
} from '../../../core/types'
import {
  getOlympicBronzeBoutNumber,
  getOlympicGlobalBoutNumber,
  getOlympicSemifinalBoutNumbers,
  resolveOlympicMatchLabel,
} from '../matchNumbers'
import { OLYMPIC_BRONZE_MIN_PARTICIPANTS } from '../../../systemMeta'

export function buildOlympicV1(input: SystemBuildInput): BracketStructure {
  const n = input.participants.length
  const b = bracketSizeForN(n)
  const seedOrder = seedOrderForBracketSize(b)
  const byPosition = new Map(input.participants.map((p) => [p.seedPosition, p]))

  const slots: Array<BracketParticipantInput | null> = seedOrder.map((seedNum) => {
    if (seedNum > n) return null
    return byPosition.get(seedNum) ?? null
  })

  const rounds: BracketRoundMatch[] = []
  const maxRound = Math.log2(b)

  for (let round = 1; round <= maxRound; round++) {
    const matchesInRound = b / 2 ** round

    for (let slotInRound = 1; slotInRound <= matchesInRound; slotInRound++) {
      const matchNumber = getOlympicGlobalBoutNumber(b, round, slotInRound)

      if (round === 1) {
        const slotIndex = (slotInRound - 1) * 2
        rounds.push({
          id: `bout-${matchNumber}`,
          round,
          slot: slotInRound,
          matchNumber,
          participantA: slots[slotIndex],
          participantB: slots[slotIndex + 1],
          label: resolveOlympicMatchLabel({
            boutNumber: matchNumber,
            round,
            maxRound,
            matchesInRound,
          }),
        })
        continue
      }

      const feederSlotA = slotInRound * 2 - 1
      const feederSlotB = slotInRound * 2
      const feederBoutA = getOlympicGlobalBoutNumber(b, round - 1, feederSlotA)
      const feederBoutB = getOlympicGlobalBoutNumber(b, round - 1, feederSlotB)

      rounds.push({
        id: `bout-${matchNumber}`,
        round,
        slot: slotInRound,
        matchNumber,
        participantA: null,
        participantB: null,
        slotHintA: formatBoutWinnerHint(feederBoutA),
        slotHintB: formatBoutWinnerHint(feederBoutB),
        slotSourceA: { matchId: `bout-${feederBoutA}`, outcome: 'winner' },
        slotSourceB: { matchId: `bout-${feederBoutB}`, outcome: 'winner' },
        label: resolveOlympicMatchLabel({
          boutNumber: matchNumber,
          round,
          maxRound,
          matchesInRound,
        }),
      })
    }
  }

  const bronzeMode = input.options.bronzeMode
  const bronzeBoutNumber = getOlympicBronzeBoutNumber(b)
  const [semifinalBoutA, semifinalBoutB] = getOlympicSemifinalBoutNumbers(b)
  const bronzeSlots =
    bronzeMode === 'TWO'
      ? [
          { id: 'bronze-1', label: formatBoutLoserHint(semifinalBoutA) },
          { id: 'bronze-2', label: formatBoutLoserHint(semifinalBoutB) },
        ]
      : bronzeMode === 'ONE'
        ? [
            {
              id: 'bronze-fight',
              label: `Бой за 3-е место (${bronzeBoutNumber})`,
              hintA: formatBoutLoserHint(semifinalBoutA),
              hintB: formatBoutLoserHint(semifinalBoutB),
              sourceA: { matchId: `bout-${semifinalBoutA}`, outcome: 'loser' as const },
              sourceB: { matchId: `bout-${semifinalBoutB}`, outcome: 'loser' as const },
            },
          ]
        : undefined

  return {
    systemId: 'olympic',
    systemVersion: 1,
    rounds,
    bronzeSlots,
  }
}

export function validateOlympicCategory(n: number, options: SystemOptions) {
  const issues = []
  if (n < 2) {
    issues.push({ code: 'TOO_FEW', message: 'Нужно минимум 2 участника' })
  }
  if (n > 32) {
    issues.push({ code: 'EXCEEDS_MAX', message: 'Олимпийская система поддерживает максимум 32 участника' })
  }
  if (options.bronzeMode && n < 4) {
    issues.push({
      code: 'BRONZE_NOT_APPLICABLE',
      message: 'Бронза недоступна при менее 4 участниках',
    })
  }
  return issues
}

export function olympicSupportedBronzeModes(n: number) {
  if (n < OLYMPIC_BRONZE_MIN_PARTICIPANTS) return null
  return ['ONE', 'TWO'] as const
}
