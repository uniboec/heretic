import type { BoutPhase } from '../mat-control/types'

const PHASE_LABELS: Record<BoutPhase, string> = {
  scheduled: 'В очереди',
  live: 'Идёт',
  pending_activity_decision: 'Идёт',
  pending_confirmation: 'Идёт',
  confirmed: 'Завершён',
}

export function formatMatControlPhase(phase: BoutPhase): string {
  return PHASE_LABELS[phase]
}
