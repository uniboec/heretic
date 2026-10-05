'use client'

import { useState } from 'react'
import { judgeStyles } from './judgeModeStyles'

const KEY_HINTS: Record<1 | 2 | 3 | 4, string | null> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
}

export function JudgeScoreButton({
  points,
  disabled,
  onClick,
  showKeyHint = false,
  disabledTitle,
}: {
  points: 1 | 2 | 3 | 4
  disabled?: boolean
  onClick: () => void
  showKeyHint?: boolean
  disabledTitle?: string
}) {
  const [flash, setFlash] = useState(false)
  const hint = KEY_HINTS[points]

  function handleClick() {
    if (disabled) return
    setFlash(true)
    window.setTimeout(() => setFlash(false), 350)
    onClick()
  }

  return (
    <button
      type="button"
      className={`${judgeStyles.scoreKey} ${flash ? judgeStyles.scoreKeyFlash : ''}`}
      disabled={disabled}
      onClick={handleClick}
      aria-label={`Плюс ${points}`}
      title={disabled ? disabledTitle : undefined}
    >
      <span>+{points}</span>
      {showKeyHint && hint ? <span className={judgeStyles.scoreKeyHint}>{hint}</span> : null}
    </button>
  )
}
