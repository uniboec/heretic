'use client'

import type { ReactNode } from 'react'
import { JudgeLandscapeGate } from './JudgeLandscapeGate'
import { judgeStyles } from './judgeModeStyles'

export function JudgeModeShell({
  serviceBar,
  boutNav,
  modeStrip,
  alerts,
  children,
  actionBar,
  footer,
}: {
  serviceBar: ReactNode
  boutNav?: ReactNode
  modeStrip?: ReactNode
  alerts?: ReactNode
  children: ReactNode
  actionBar?: ReactNode
  footer?: ReactNode
}) {
  return (
    <JudgeLandscapeGate>
      <div className={judgeStyles.root}>
        {serviceBar}
        {boutNav}
        {modeStrip}
        {alerts}
        <div className={judgeStyles.main} role="main">
          <div className={judgeStyles.workScroll} data-testid="judge-work-scroll">{children}</div>
          {actionBar ? <div className={judgeStyles.actionBarZone}>{actionBar}</div> : null}
          {footer}
        </div>
      </div>
    </JudgeLandscapeGate>
  )
}
