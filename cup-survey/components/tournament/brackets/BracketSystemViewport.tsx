'use client'

import type { ReactNode } from 'react'

interface BracketSystemViewportProps {
  children: ReactNode
  showHint?: boolean
}

export function BracketSystemViewport({ children, showHint = true }: BracketSystemViewportProps) {
  return (
    <div className="bracket-system-viewport-wrap">
      {showHint && (
        <p className="bracket-system-viewport__hint bracket-tree__scroll-hint print:hidden">
          Листайте вправо и влево, чтобы увидеть всю сетку
        </p>
      )}
      <div className="bracket-tree__scroll bracket-system-viewport">{children}</div>
    </div>
  )
}
