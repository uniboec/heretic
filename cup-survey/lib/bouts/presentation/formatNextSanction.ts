import type { PenaltyLadder, PenaltySanction } from '../../config/fseRules'
import { awardedPointsForSanction } from '../../config/fseRules'

const SANCTION_SHORT: Record<PenaltySanction, string> = {
  REMARK: 'замечание',
  WARNING_1: 'предупреждение 1',
  WARNING_2: 'предупреждение 2',
  WARNING_3: 'предупреждение 3',
  DISQUALIFICATION: 'дисквалификация',
}

export function formatNextSanctionPreview(
  sanction: PenaltySanction,
  ladder: PenaltyLadder,
): string {
  if (sanction === 'DISQUALIFICATION') {
    return 'Завершит поединок'
  }
  const points = awardedPointsForSanction(sanction)
  const ladderLabel =
    ladder === 'GENERAL'
      ? 'нарушение'
      : ladder === 'OUT_OF_BOUNDS'
        ? 'выход за ковёр'
        : 'пассивность'
  if (points > 0) {
    return `Следующее: +${points} сопернику`
  }
  return `Следующее: ${SANCTION_SHORT[sanction]} (${ladderLabel})`
}

export function formatSanctionShort(sanction: PenaltySanction): string {
  switch (sanction) {
    case 'REMARK':
      return 'З'
    case 'WARNING_1':
      return 'П1'
    case 'WARNING_2':
      return 'П2'
    case 'WARNING_3':
      return 'П3'
    case 'DISQUALIFICATION':
      return 'ДСК'
  }
}
