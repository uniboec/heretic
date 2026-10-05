'use client'

import type { ReactNode } from 'react'
import type { MatControlBoutSnapshot } from '@/lib/bouts/matControlSnapshot'

export function JudgePhaseStage({
  activeBout,
  prep,
  live,
  activityCorrection,
  activity,
  confirmation,
}: {
  activeBout: MatControlBoutSnapshot | null
  prep: ReactNode
  live: ReactNode
  activityCorrection: ReactNode
  activity: ReactNode
  confirmation: ReactNode
}) {
  if (!activeBout) return null

  const { boutPhase, activityCorrectionMode, periodCorrectionMode } = activeBout.execution

  if (boutPhase === 'scheduled' || boutPhase === 'live') return live
  if (boutPhase === 'pending_activity_decision' && activityCorrectionMode) return activityCorrection
  if (boutPhase === 'pending_activity_decision') return activity
  if (boutPhase === 'pending_confirmation' || boutPhase === 'confirmed') return confirmation

  if (periodCorrectionMode && boutPhase === 'live') return live

  return null
}
