'use client'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'

export type SegmentedFilterOption<T extends string | number> = {
  value: T
  label: string
  count?: number
}

export function PublicSegmentedFilter<T extends string | number>({
  label,
  ariaLabel,
  options,
  value,
  onChange,
  scrollable = false,
  equalWidth = true,
}: {
  label?: string
  ariaLabel: string
  options: SegmentedFilterOption<T>[]
  value: T
  onChange: (value: T) => void
  scrollable?: boolean
  equalWidth?: boolean
}) {
  return (
    <div className={tournamentPublicUi.boutsFilterRow}>
      {label ? <span className={tournamentPublicUi.boutsFilterRowLabel}>{label}</span> : null}
      <div
        className={cn(
          tournamentPublicUi.boutsSegmented,
          scrollable && tournamentPublicUi.boutsSegmentedScroll,
          equalWidth && !scrollable && tournamentPublicUi.boutsSegmentedEqual,
        )}
        role="group"
        aria-label={ariaLabel}
      >
        {options.map((option) => {
          const active = value === option.value

          return (
            <Button
              key={String(option.value)}
              type="button"
              variant="ghost"
              className={cn(
                tournamentPublicUi.boutsSegmentBtn,
                scrollable && tournamentPublicUi.boutsSegmentBtnScroll,
                equalWidth && !scrollable && tournamentPublicUi.boutsSegmentBtnEqual,
                active && tournamentPublicUi.boutsSegmentBtnActive,
              )}
              onClick={() => onChange(option.value)}
              aria-pressed={active}
            >
              <span>{option.label}</span>
              {option.count !== undefined ? (
                <span
                  className={cn(
                    tournamentPublicUi.boutsSegmentCount,
                    active && tournamentPublicUi.boutsSegmentCountActive,
                  )}
                >
                  {option.count}
                </span>
              ) : null}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
