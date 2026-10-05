'use client'

import type { Corner } from '@/lib/bouts/mat-control/types'

function cornerBadgeClass(corner: Corner): string {
  return corner === 'red'
    ? 'bg-[#E5484D] text-white'
    : 'bg-[#3478F6] text-white'
}

function cornerLabel(corner: Corner): string {
  return corner === 'red' ? 'Красный' : 'Синий'
}

function AthleteOutcomeCard({
  variant,
  corner,
  name,
}: {
  variant: 'winner' | 'loser'
  corner: Corner
  name: string
}) {
  const isWinner = variant === 'winner'

  return (
    <div
      className={`rounded-lg border-2 px-3 py-2.5 ${
        isWinner
          ? 'border-emerald-500/45 bg-emerald-50/90'
          : 'border-[#E5484D]/35 bg-[#FFF5F5]/90'
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-[0.06em] ${
          isWinner ? 'text-emerald-800' : 'text-[#B42318]'
        }`}
      >
        {isWinner ? 'Победа' : 'Поражение'}
      </p>
      <div className="mt-1.5 flex items-start gap-2">
        <span
          className={`shrink-0 rounded-[5px] px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.05em] ${cornerBadgeClass(corner)}`}
        >
          {cornerLabel(corner)}
        </span>
        <p className="min-w-0 text-sm font-semibold leading-snug text-[#101828]">{name}</p>
      </div>
    </div>
  )
}

export function BoutOutcomeConfirmSummary({
  winnerName,
  winnerCorner,
  loserName,
  loserCorner,
}: {
  winnerName: string
  winnerCorner: Corner
  loserName: string
  loserCorner: Corner
}) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <AthleteOutcomeCard variant="winner" corner={winnerCorner} name={winnerName} />
      <AthleteOutcomeCard variant="loser" corner={loserCorner} name={loserName} />
    </div>
  )
}
