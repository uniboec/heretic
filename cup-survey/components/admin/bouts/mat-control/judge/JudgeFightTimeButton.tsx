'use client'

import { judgeStyles } from './judgeModeStyles'

export function JudgeFightTimeButton({
  clockRunning,
  disabled,
  disabledTitle,
  onClick,
  prepLabel,
}: {
  clockRunning: boolean
  disabled?: boolean
  disabledTitle?: string
  onClick: () => void
  prepLabel?: boolean
}) {
  const styleClass = clockRunning && !prepLabel ? judgeStyles.btnFightStop : judgeStyles.btnFightStart

  if (prepLabel) {
    return (
      <button
        type="button"
        className={`${judgeStyles.btnFight} ${judgeStyles.btnFightStart}`}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        onClick={onClick}
        data-testid="judge-fight-button"
      >
        <span className={judgeStyles.btnFightTitle}>ФАЙТ</span>
        <span className={judgeStyles.btnFightSub}>Начать поединок</span>
      </button>
    )
  }

  if (clockRunning) {
    return (
      <button
        type="button"
        className={`${judgeStyles.btnFight} ${styleClass}`}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        onClick={onClick}
        data-testid="judge-fight-button"
      >
        <span className={judgeStyles.btnFightTitle}>ТАЙМ</span>
        <span className={judgeStyles.btnFightSub}>Остановить время</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`${judgeStyles.btnFight} ${styleClass}`}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      onClick={onClick}
      data-testid="judge-fight-button"
    >
      <span className={judgeStyles.btnFightTitle}>ФАЙТ</span>
      <span className={judgeStyles.btnFightSub}>Запустить время</span>
    </button>
  )
}
