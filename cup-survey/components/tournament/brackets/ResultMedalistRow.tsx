'use client'

const MEDAL_LABELS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

export type ResultMedalistRowProps = {
  placement: number
  displayName: string
  clubName: string
  city: string
  provisional: boolean
}

export function ResultMedalistRow({
  placement,
  displayName,
  clubName,
  city,
  provisional,
}: ResultMedalistRowProps) {
  const meta = [clubName, city].filter(Boolean).join(' · ')

  return (
    <li className="bracket-podium__item">
      <span className="bracket-podium__medal" aria-hidden="true">
        {MEDAL_LABELS[placement] ?? `${placement}.`}
      </span>
      <div className="bracket-podium__body">
        <p className="bracket-podium__name">{displayName}</p>
        {meta ? <p className="bracket-podium__meta">{meta}</p> : null}
        {provisional ? (
          <p className="mt-0.5 text-[11px] font-medium text-muted">уточняется</p>
        ) : null}
      </div>
    </li>
  )
}
