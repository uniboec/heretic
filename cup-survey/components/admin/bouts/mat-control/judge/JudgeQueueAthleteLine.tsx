'use client'

import type { InternalBoutSide } from '@/lib/bouts/types'
import type { MandateWarning } from '@/lib/mandate/types'

import { getQueueAthleteDetails } from './judgeQueueFormat'

function MandateWarningIcon({
  warnings,
  compact = false,
}: {
  warnings: MandateWarning[]
  compact?: boolean
}) {
  if (warnings.length === 0) return null

  const title = warnings.map((warning) => warning.message).join('\n')

  return (
    <span
      className={`shrink-0 text-warning-foreground ${compact ? 'text-[11px]' : 'text-xs'}`}
      title={title}
      aria-label={`${warnings.length} замечаний мандатной комиссии`}
    >
      ⚠
    </span>
  )
}

export function JudgeQueueAthleteLine({
  side,
  compact = false,
  warnings = [],
}: {
  side: InternalBoutSide
  compact?: boolean
  warnings?: MandateWarning[]
}) {
  if (compact) {
    const { name, clubCity } = getQueueAthleteDetails(side)
    return (
      <span className="flex items-center gap-1 text-[12px] font-medium leading-none text-foreground">
        <MandateWarningIcon warnings={warnings} compact />
        <span className="whitespace-nowrap">{name}</span>
        {clubCity ? (
          <>
            <span className="shrink-0 text-muted">·</span>
            <span className="max-w-[12rem] truncate text-muted">{clubCity}</span>
          </>
        ) : null}
      </span>
    )
  }

  const { name, clubCity } = getQueueAthleteDetails(side)

  return (
    <div className="min-w-0">
      <div className="flex items-start gap-1">
        <MandateWarningIcon warnings={warnings} />
        <p className="min-w-0 truncate text-[13px] font-semibold leading-snug text-foreground">
          {name}
        </p>
      </div>
      {clubCity ? (
        <p className="truncate text-[11px] leading-snug text-muted">{clubCity}</p>
      ) : null}
    </div>
  )
}
