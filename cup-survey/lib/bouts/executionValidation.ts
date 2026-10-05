import type { ScheduledBout } from './scheduleTypes'
import {
  BoutAlreadyInProgressError,
  BoutExecutionOutOfOrderError,
  BoutNotReadyError,
} from './errors'

export function assertCanStartBout(input: {
  schedule: ScheduledBout[]
  boutId: string
  mutationNow: Date
  inProgressId: string | null
}): ScheduledBout {
  if (input.inProgressId) {
    throw new BoutAlreadyInProgressError()
  }

  const nextBout = input.schedule.find((bout) => bout.timing.status === 'upcoming')
  if (!nextBout || nextBout.id !== input.boutId) {
    throw new BoutNotReadyError('Можно начать только следующий поединок на площадке')
  }

  const estimatedStartAt = new Date(nextBout.timing.estimatedStartAt)
  if (input.mutationNow.getTime() < estimatedStartAt.getTime()) {
    throw new BoutNotReadyError()
  }

  return nextBout
}

export function assertCanCompleteBout(input: {
  schedule: ScheduledBout[]
  boutId: string
  mutationNow: Date
  actualStartAt: Date
}): void {
  const currentBout = input.schedule.find((bout) => bout.timing.status === 'in_progress')
  if (!currentBout || currentBout.id !== input.boutId) {
    throw new BoutExecutionOutOfOrderError('Можно завершить только текущий поединок')
  }

  if (input.mutationNow.getTime() < input.actualStartAt.getTime()) {
    throw new BoutExecutionOutOfOrderError()
  }
}
