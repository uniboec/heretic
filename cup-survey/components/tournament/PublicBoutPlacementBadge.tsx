import { Medal, Trophy } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  PUBLIC_BOUT_PLACEMENT_LABELS,
  type PublicBoutPlacementKind,
} from '@/lib/bouts/publicBoutPlacement'
import { boutCardUi } from '@/components/tournament/tournamentPublicUiClasses'

export function PublicBoutPlacementBadge({
  placement,
  compact = false,
}: {
  placement: PublicBoutPlacementKind
  compact?: boolean
}) {
  const Icon = placement === 'final' ? Trophy : Medal

  return (
    <span
      className={cn(boutCardUi.placementBadge, boutCardUi.placementBadgeKind[placement])}
      title={PUBLIC_BOUT_PLACEMENT_LABELS[placement]}
    >
      <Icon className="size-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      <span className={compact ? 'max-sm:hidden' : undefined}>
        {PUBLIC_BOUT_PLACEMENT_LABELS[placement]}
      </span>
    </span>
  )
}
