'use client'

import type { ReactNode } from 'react'
import { judgeStyles } from './judgeModeStyles'

export function JudgeFooterStrips({ history, queue }: { history: ReactNode; queue: ReactNode }) {
  return (
    <footer className={judgeStyles.footerZone}>
      {history}
      {queue}
    </footer>
  )
}
