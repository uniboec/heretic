import { describe, expect, it } from 'vitest'
import { formatPublicBoutTiming } from '../boutTimingPresentation'
import type { BoutTiming } from '../scheduleTypes'

describe('formatPublicBoutTiming', () => {
  it('shows start time only for upcoming bouts', () => {
    const timing: BoutTiming = {
      durationMinutes: 3,
      scheduledStartAt: '2026-10-03T05:00:00.000Z',
      scheduledEndAt: '2026-10-03T05:03:00.000Z',
      estimatedStartAt: '2026-10-03T05:00:00.000Z',
      estimatedEndAt: '2026-10-03T05:03:00.000Z',
      status: 'upcoming',
      delayMinutes: 0,
      isDelayed: false,
    }

    const presentation = formatPublicBoutTiming(timing, new Date('2026-09-27T12:00:00.000Z'))
    expect(presentation.statusLabel).toBe('В очереди')
    expect(presentation.startTime).toBe('10:00')
    expect(presentation.approximate).toBe(true)
  })

  it('shows delayed start on tournament day', () => {
    const timing: BoutTiming = {
      durationMinutes: 2,
      scheduledStartAt: '2026-10-03T05:00:00.000Z',
      scheduledEndAt: '2026-10-03T05:02:00.000Z',
      estimatedStartAt: '2026-10-03T05:07:00.000Z',
      estimatedEndAt: '2026-10-03T05:09:00.000Z',
      status: 'upcoming',
      delayMinutes: 5,
      isDelayed: true,
    }

    const presentation = formatPublicBoutTiming(timing, new Date('2026-10-03T05:00:00.000Z'))
    expect(presentation.startTime).toBe('10:07')
    expect(presentation.secondary).toBe('по плану 10:00')
    expect(presentation.delayLabel).toBe('Задержка +5 мин')
  })

  it('shows actual start time for completed bouts without end time', () => {
    const timing: BoutTiming = {
      durationMinutes: 3,
      scheduledStartAt: '2026-10-03T05:00:00.000Z',
      scheduledEndAt: '2026-10-03T05:03:00.000Z',
      estimatedStartAt: '2026-10-03T05:00:00.000Z',
      estimatedEndAt: '2026-10-03T05:03:00.000Z',
      actualStartAt: '2026-10-03T05:01:00.000Z',
      actualEndAt: '2026-10-03T05:04:00.000Z',
      status: 'completed',
      delayMinutes: 1,
      isDelayed: true,
    }

    const presentation = formatPublicBoutTiming(timing)
    expect(presentation.statusLabel).toBe('Завершён')
    expect(presentation.startTime).toBe('10:01')
  })
})
