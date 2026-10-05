'use client'

import { useState } from 'react'
import type { TechnicalScoreActionDef } from '@/lib/config/technicalScoreActions'
import { judgeStyles } from './judgeModeStyles'

export function JudgeTechnicalActionButton({
  action,
  disabled,
  disabledTitle,
  onClick,
}: {
  action: TechnicalScoreActionDef
  disabled?: boolean
  onClick: () => void
  disabledTitle?: string
}) {
  const [flash, setFlash] = useState(false)

  function handleClick() {
    if (disabled) return
    setFlash(true)
    window.setTimeout(() => setFlash(false), 350)
    onClick()
  }

  return (
    <button
      type="button"
      className={`${judgeStyles.technicalActionKey} ${flash ? judgeStyles.technicalActionKeyFlash : ''}`}
      disabled={disabled}
      onClick={handleClick}
      aria-label={`${action.label} · +${action.points}`}
      title={action.label}
    >
      <span className="truncate">{action.label}</span>
    </button>
  )
}
