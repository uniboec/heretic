'use client'

import type { PenaltySanction } from '@/lib/config/fseRules'
import { buildDisciplinaryCards } from '@/lib/bouts/presentation/disciplinaryCard'
import { judgeStyles } from './judgeModeStyles'

export function JudgeDisciplinaryCards({
  general,
  outOfBounds,
  passivity,
}: {
  general: PenaltySanction | null
  outOfBounds: PenaltySanction | null
  passivity?: PenaltySanction | null
}) {
  const cards = buildDisciplinaryCards({ general, outOfBounds, passivity })
  if (cards.length === 0) return null

  return (
    <div className={judgeStyles.disciplinaryCardsRow} aria-label="Дисциплинарные карточки">
      {cards.map((card, index) => (
        <span
          key={`${card.sourceLabel}-${card.color}`}
          className={`${judgeStyles.disciplinaryCard} ${
            card.color === 'yellow'
              ? judgeStyles.disciplinaryCardYellow
              : judgeStyles.disciplinaryCardRed
          } ${index > 0 ? judgeStyles.disciplinaryCardStacked : ''}`}
          title={`${card.sourceLabel}: ${card.sanctionLabel}`}
          aria-label={`${card.color === 'yellow' ? 'Жёлтая' : 'Красная'} карточка — ${card.sourceLabel}`}
        />
      ))}
    </div>
  )
}
