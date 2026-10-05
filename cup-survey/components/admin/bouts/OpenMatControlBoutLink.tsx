'use client'

import Link from 'next/link'
import { PanelRightOpen } from 'lucide-react'
import { boutHasBothAthletes } from '@/lib/bouts/boutReadiness'
import { matControlHref } from '@/lib/bouts/matControlUrls'
import type { BoutSideData } from '@/components/tournament/BoutCard'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { adminBoutsIconBtn } from '@/lib/ui/adminSurfaceStyles'

export function OpenMatControlBoutLink({
  matIndex,
  boutId,
  sideA,
  sideB,
  className,
  compact = true,
  iconOnly = false,
}: {
  matIndex: number
  boutId: string
  sideA: BoutSideData
  sideB: BoutSideData
  className?: string
  compact?: boolean
  iconOnly?: boolean
}) {
  if (!boutHasBothAthletes(sideA, sideB)) {
    return (
      <span
        className={cn('text-xs text-muted', className)}
        title="Участники ещё не определены — ожидается победитель или проигравший предыдущего боя"
      >
        —
      </span>
    )
  }

  return (
    <Link href={matControlHref(matIndex, { boutId })} className={className}>
      <Button
        type="button"
        variant={iconOnly ? 'ghost' : 'secondary'}
        className={cn(
          iconOnly
            ? adminBoutsIconBtn
            : compact
              ? 'min-h-9 whitespace-nowrap px-2.5 py-1 text-xs'
              : undefined,
        )}
        aria-label={iconOnly ? 'Панель боя' : undefined}
        title={iconOnly ? 'Панель боя' : undefined}
      >
        {iconOnly ? (
          <PanelRightOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          'Панель боя'
        )}
      </Button>
    </Link>
  )
}
