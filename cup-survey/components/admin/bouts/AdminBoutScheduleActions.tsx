'use client'

import type { BoutSideData } from '@/components/tournament/BoutCard'
import { CorrectBoutResultButton } from '@/components/admin/bouts/CorrectBoutResultButton'
import { OpenMatControlBoutLink } from '@/components/admin/bouts/OpenMatControlBoutLink'
import { ViewBracketCategoryButton } from '@/components/tournament/brackets/ViewBracketCategoryButton'
import type { BoutDisplayStatus } from '@/lib/bouts/presentation/boutDisplayStatus'
import { adminBoutsRowActions } from '@/lib/ui/adminSurfaceStyles'

export function AdminBoutScheduleActions({
  matIndex,
  boutId,
  categoryKey,
  categoryTitle,
  sideA,
  sideB,
  displayStatus,
}: {
  matIndex: number
  boutId: string
  categoryKey?: string
  categoryTitle?: string
  sideA: BoutSideData
  sideB: BoutSideData
  displayStatus: BoutDisplayStatus
}) {
  const completed = displayStatus === 'completed'

  return (
    <div className={adminBoutsRowActions}>
      {categoryKey ? (
        <ViewBracketCategoryButton
          categoryKey={categoryKey}
          categoryTitle={categoryTitle}
          variant="admin"
          iconOnly
        />
      ) : null}
      {completed ? (
        <CorrectBoutResultButton
          matIndex={matIndex}
          boutId={boutId}
          sideA={sideA}
          sideB={sideB}
          iconOnly
        />
      ) : (
        <OpenMatControlBoutLink
          matIndex={matIndex}
          boutId={boutId}
          sideA={sideA}
          sideB={sideB}
          iconOnly
        />
      )}
    </div>
  )
}
