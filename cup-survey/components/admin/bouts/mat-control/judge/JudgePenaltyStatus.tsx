'use client'

import {
  getPenaltyLadderSteps,
  type PenaltyLadder,
  type PenaltySanction,
} from '@/lib/config/fseRules'
import { formatSanctionShort } from '@/lib/bouts/presentation/formatNextSanction'
import { judgeStyles } from './judgeModeStyles'

const SANCTION_TOOLTIPS: Record<PenaltySanction, string> = {
  REMARK: 'Замечание (устар.)',
  WARNING_1: 'Предупреждение 1 (+1 сопернику)',
  WARNING_2: 'Предупреждение 2 (+2 сопернику)',
  WARNING_3: 'Предупреждение 3 (+3 сопернику)',
  DISQUALIFICATION: 'Дисквалификация',
}

function stepVisual(
  step: PenaltySanction,
  current: PenaltySanction | null,
  next: PenaltySanction,
  ladder: PenaltyLadder,
): 'done' | 'next' | 'future' {
  const steps = getPenaltyLadderSteps(ladder)
  const currentIdx = current ? steps.indexOf(current) : -1
  const stepIdx = steps.indexOf(step)
  if (currentIdx >= 0 && stepIdx <= currentIdx) return 'done'
  if (step === next) return 'next'
  return 'future'
}

function LadderRail({
  label,
  ladder,
  current,
  next,
}: {
  label: string
  ladder: PenaltyLadder
  current: PenaltySanction | null
  next: PenaltySanction
}) {
  const steps = getPenaltyLadderSteps(ladder)

  return (
    <div className={judgeStyles.ladderRail} title={`${label}: П1 → П2 → П3 → ДСК`}>
      <span className={judgeStyles.ladderRailLabel}>{label}</span>
      <div className={judgeStyles.ladderRailSteps}>
        {steps.map((step) => {
          const visual = stepVisual(step, current, next, ladder)
          const short = formatSanctionShort(step)
          const className =
            visual === 'done'
              ? judgeStyles.ladderRailStepDone
              : visual === 'next'
                ? judgeStyles.ladderRailStepNext
                : judgeStyles.ladderRailStepFuture
          return (
            <span
              key={step}
              className={`${judgeStyles.ladderRailStep} ${className}`}
              title={SANCTION_TOOLTIPS[step]}
            >
              <span aria-hidden>{visual === 'done' ? '●' : '○'}</span>
              <span>{short}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function JudgePenaltyStatus({
  general,
  outOfBounds,
  passivity,
  nextGeneral,
  nextOutOfBounds,
  nextPassivity,
}: {
  general: PenaltySanction | null
  outOfBounds: PenaltySanction | null
  passivity: PenaltySanction | null
  nextGeneral: PenaltySanction
  nextOutOfBounds: PenaltySanction
  nextPassivity: PenaltySanction
}) {
  return (
    <div className={judgeStyles.ladderSection}>
      <LadderRail label="Нарушения" ladder="GENERAL" current={general} next={nextGeneral} />
      <LadderRail
        label="Выходы"
        ladder="OUT_OF_BOUNDS"
        current={outOfBounds}
        next={nextOutOfBounds}
      />
      <LadderRail
        label="Пассивность"
        ladder="PASSIVITY"
        current={passivity}
        next={nextPassivity}
      />
    </div>
  )
}
