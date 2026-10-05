'use client'

import { judgeStyles } from '../judgeModeStyles'

export function JudgeCorrectionCenterLabel({ label }: { label: string }) {
  return (
    <div className={judgeStyles.correctionCenterSlot}>
      <p className={judgeStyles.correctionCenterLabel}>{label}</p>
    </div>
  )
}
