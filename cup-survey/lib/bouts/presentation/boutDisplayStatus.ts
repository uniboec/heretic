export type BoutDisplayStatus = 'completed' | 'in_progress' | 'preparing' | 'scheduled'

export type BoutDisplayExecution = {
  boutPhase?: string | null
  actualStartAt?: Date | string | null
  actualEndAt?: Date | string | null
  clockStartedAt?: Date | string | null
  officialStartedAt?: Date | string | null
}

const DISPLAY_STATUS_LABELS: Record<BoutDisplayStatus, string> = {
  completed: 'Завершён',
  in_progress: 'Идёт',
  preparing: 'Подготовка',
  scheduled: 'В очереди',
}

export function isBoutExecutionCompleted(execution: BoutDisplayExecution): boolean {
  if (execution.boutPhase === 'confirmed') return true
  return execution.actualStartAt != null && execution.actualEndAt != null
}

export function isBoutExecutionInProgress(execution: BoutDisplayExecution): boolean {
  if (isBoutExecutionCompleted(execution)) return false

  const phase = execution.boutPhase ?? 'scheduled'
  if (phase !== 'scheduled' && phase !== 'confirmed') return true
  if (execution.clockStartedAt != null || execution.officialStartedAt != null) return true
  if (execution.actualStartAt != null && execution.actualEndAt == null) return true
  return false
}

export function resolveMatBoutDisplayStatuses(input: {
  orderedBoutIds: string[]
  executions: Map<string, BoutDisplayExecution>
}): Map<string, BoutDisplayStatus> {
  const result = new Map<string, BoutDisplayStatus>()
  let inProgressId: string | null = null
  let preparingId: string | null = null

  for (const boutId of input.orderedBoutIds) {
    const execution = input.executions.get(boutId) ?? {}
    if (isBoutExecutionCompleted(execution)) {
      result.set(boutId, 'completed')
      continue
    }
    if (isBoutExecutionInProgress(execution)) {
      inProgressId = boutId
      result.set(boutId, 'in_progress')
      continue
    }
    result.set(boutId, 'scheduled')
  }

  if (inProgressId) {
    const startIndex = input.orderedBoutIds.indexOf(inProgressId)
    for (let index = startIndex + 1; index < input.orderedBoutIds.length; index += 1) {
      const boutId = input.orderedBoutIds[index]!
      const status = result.get(boutId)
      if (status === 'completed') continue
      preparingId = boutId
      result.set(boutId, 'preparing')
      break
    }
  }

  for (const boutId of input.orderedBoutIds) {
    if (boutId === inProgressId || boutId === preparingId) continue
    const status = result.get(boutId)
    if (status === 'completed' || status === 'in_progress' || status === 'preparing') continue
    result.set(boutId, 'scheduled')
  }

  return result
}

export function formatBoutDisplayStatus(status: BoutDisplayStatus): string {
  return DISPLAY_STATUS_LABELS[status]
}

export function boutDisplayStatusTone(
  status: BoutDisplayStatus,
): 'success' | 'info' | 'warning' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'in_progress') return 'info'
  if (status === 'preparing') return 'warning'
  return 'neutral'
}

export function resolveBoutDisplayStatusFromTiming(timing?: {
  displayStatus?: BoutDisplayStatus
  status?: 'upcoming' | 'in_progress' | 'completed'
}): BoutDisplayStatus {
  if (timing?.displayStatus) return timing.displayStatus
  if (timing?.status === 'completed') return 'completed'
  if (timing?.status === 'in_progress') return 'in_progress'
  return 'scheduled'
}
