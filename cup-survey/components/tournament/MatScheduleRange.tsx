import { cn } from '@/lib/cn'

interface MatScheduleRangeProps {
  startTime: string
  endTime?: string | null
  className?: string
}

function TimeBlock({
  label,
  time,
  approximate,
}: {
  label: string
  time: string
  approximate?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 shadow-[0_1px_2px_rgb(15_20_25_/_0.04)]">
      <span className="text-[0.625rem] font-bold uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </span>
      <span className="inline-flex items-baseline gap-0.5 text-sm font-extrabold tabular-nums leading-none text-[var(--color-foreground)]">
        {approximate ? (
          <span className="text-[0.6875rem] font-bold text-[var(--color-muted)]">≈</span>
        ) : null}
        {time}
      </span>
    </span>
  )
}

export function MatScheduleRange({ startTime, endTime, className }: MatScheduleRangeProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <TimeBlock label="начало" time={startTime} />
      {endTime ? (
        <>
          <span className="text-sm font-bold text-[var(--color-muted)]" aria-hidden="true">
            →
          </span>
          <TimeBlock label="конец" time={endTime} approximate />
        </>
      ) : null}
    </div>
  )
}
