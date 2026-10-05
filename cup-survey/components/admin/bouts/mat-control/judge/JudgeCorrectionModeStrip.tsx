'use client'

import { judgeStyles } from './judgeModeStyles'

export function JudgeCorrectionModeStrip({ message }: { message: string }) {
  return (
    <div className={judgeStyles.correctionModeStrip}>
      <span className={judgeStyles.correctionModeStripIcon} aria-hidden>⚠</span>
      <span className={judgeStyles.correctionModeStripText}>{message}</span>
    </div>
  )
}
