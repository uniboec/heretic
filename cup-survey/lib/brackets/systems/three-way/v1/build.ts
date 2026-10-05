import { formatBoutLoserHint, formatBoutWinnerHint } from '../../../labels'
import type {
  BracketRoundMatch,
  BracketStructure,
  SystemBuildInput,
  SystemOptions,
} from '../../../core/types'

/**
 * Тройка с возвратом (олимпийская с одним свободным по жеребьёвке):
 * бои 1 и 2 — посевы 1–2; посев 3 — свободный.
 */
export function buildThreeWayV1(input: SystemBuildInput): BracketStructure {
  const sorted = [...input.participants].sort((a, b) => a.seedPosition - b.seedPosition)
  const [first, second, byeHolder] = sorted

  const rounds: BracketRoundMatch[] = [
    {
      id: 'bout-1',
      round: 1,
      slot: 1,
      matchNumber: 1,
      participantA: first,
      participantB: second,
      label: 'Бой 1',
    },
    {
      id: 'bout-2',
      round: 2,
      slot: 1,
      matchNumber: 2,
      participantA: null,
      participantB: byeHolder,
      slotHintA: formatBoutLoserHint(1),
      slotSourceA: { matchId: 'bout-1', outcome: 'loser' },
      label: 'Бой 2',
    },
    {
      id: 'bout-3',
      round: 3,
      slot: 1,
      matchNumber: 3,
      participantA: null,
      participantB: null,
      slotHintA: formatBoutWinnerHint(1),
      slotHintB: formatBoutWinnerHint(2),
      slotSourceA: { matchId: 'bout-1', outcome: 'winner' },
      slotSourceB: { matchId: 'bout-2', outcome: 'winner' },
    },
  ]

  return {
    systemId: 'three_way',
    systemVersion: 1,
    rounds,
    bronzeSlots: [
      {
        id: 'third-place',
        label: formatBoutLoserHint(2),
        sourceA: { matchId: 'bout-2', outcome: 'loser' },
      },
    ],
  }
}

export function validateThreeWayCategory(n: number) {
  const issues = []
  if (n !== 3) {
    issues.push({
      code: 'INVALID_COUNT',
      message: 'Система «Тройка с возвратом» применяется только при 3 участниках',
    })
  }
  return issues
}

export function supportedThreeWayBronzeModes(_n: number) {
  return null
}

export function validateThreeWayOptions(_n: number, _options: SystemOptions) {
  return []
}
