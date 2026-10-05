import type { PenaltySanction } from '@/lib/config/fseRules'

export type DisciplinaryCardColor = 'yellow' | 'red'

export type DisciplinaryCardDisplay = {
  color: DisciplinaryCardColor
  sourceLabel: string
  sanctionLabel: string
}

const SANCTION_CARD_LABELS: Record<PenaltySanction, string> = {
  REMARK: '',
  WARNING_1: '',
  WARNING_2: 'Второе предупреждение',
  WARNING_3: 'Третье предупреждение',
  DISQUALIFICATION: 'Дисквалификация',
}

/** Maps ladder sanction to referee card color (П2/П3 → yellow, ДСК → red). */
export function disciplinaryCardColor(
  sanction: PenaltySanction | null | undefined,
): DisciplinaryCardColor | null {
  if (!sanction) return null
  if (sanction === 'DISQUALIFICATION') return 'red'
  if (sanction === 'WARNING_2' || sanction === 'WARNING_3') return 'yellow'
  return null
}

export function buildDisciplinaryCards(input: {
  general: PenaltySanction | null
  outOfBounds: PenaltySanction | null
  passivity?: PenaltySanction | null
}): DisciplinaryCardDisplay[] {
  const cards: DisciplinaryCardDisplay[] = []

  const generalColor = disciplinaryCardColor(input.general)
  if (generalColor && input.general) {
    cards.push({
      color: generalColor,
      sourceLabel: 'Нарушение',
      sanctionLabel: SANCTION_CARD_LABELS[input.general],
    })
  }

  const outOfBoundsColor = disciplinaryCardColor(input.outOfBounds)
  if (outOfBoundsColor && input.outOfBounds) {
    cards.push({
      color: outOfBoundsColor,
      sourceLabel: 'Выход за ковёр',
      sanctionLabel: SANCTION_CARD_LABELS[input.outOfBounds],
    })
  }

  const passivityColor = disciplinaryCardColor(input.passivity)
  if (passivityColor && input.passivity) {
    cards.push({
      color: passivityColor,
      sourceLabel: 'Пассивность',
      sanctionLabel: SANCTION_CARD_LABELS[input.passivity],
    })
  }

  return cards
}
