import { cn } from '@/lib/cn'

export function AthleteRatingAthleteCell({
  displayName,
  clubName,
  city,
  className,
}: {
  displayName: string
  clubName?: string | null
  city?: string | null
  className?: string
}) {
  const clubLine = [clubName?.trim(), city?.trim()].filter(Boolean).join(' · ')

  return (
    <div className={cn('grid min-w-0 gap-0.5', className)}>
      <p className="font-semibold text-foreground [overflow-wrap:anywhere]">{displayName}</p>
      {clubLine ? (
        <p className="truncate text-sm leading-snug text-muted whitespace-nowrap" title={clubLine}>
          {clubLine}
        </p>
      ) : null}
    </div>
  )
}
