'use client'

import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  boutDisplayStatusTone,
  formatBoutDisplayStatus,
  resolveBoutDisplayStatusFromTiming,
  type BoutDisplayStatus,
} from '@/lib/bouts/presentation/boutDisplayStatus'
import type { BoutTiming } from '@/lib/bouts/scheduleTypes'

export function BoutDisplayStatusBadge({
  timing,
  status,
}: {
  timing?: BoutTiming
  status?: BoutDisplayStatus
}) {
  const resolved = status ?? resolveBoutDisplayStatusFromTiming(timing)

  return (
    <StatusBadge tone={boutDisplayStatusTone(resolved)} appearance="pill">
      {formatBoutDisplayStatus(resolved)}
    </StatusBadge>
  )
}
