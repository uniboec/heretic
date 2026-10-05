import { describe, expect, it } from 'vitest'
import { applyScheduleHintLabels } from '../resolveScheduleHintLabels'
import type { PublicMatTiming } from '../scheduleTypes'

function buildMat(bouts: PublicMatTiming['bouts']): PublicMatTiming[] {
  return [
    {
      matIndex: 1,
      configuredStartTime: '09:00',
      scheduledEndAt: null,
      estimatedEndAt: null,
      bouts,
    },
  ]
}

describe('applyScheduleHintLabels', () => {
  it('replaces internal matchNumber hints with schedule display numbers', () => {
    const mats = buildMat([
      {
        id: 'cat::bout-2',
        matchNumber: 2,
        scheduleDisplayNumber: '1-21',
        schedulePosition: 21,
        matId: '1',
        matNumber: 1,
        isFrozen: false,
        isInEditableZone: true,
        isNextStartable: false,
        matIndex: 1,
        categoryKey: 'cat',
        categoryTitle: 'Cat',
        discipline: 'd',
        competitionStage: 1,
        schedulePhase: 'elimination',
        sideA: { kind: 'athlete', entryId: 'a', displayName: 'A', clubName: '', city: '', publicNumber: null },
        sideB: { kind: 'athlete', entryId: 'b', displayName: 'B', clubName: '', city: '', publicNumber: null },
        timing: {
          durationMinutes: 3,
          scheduledStartAt: '2026-01-01T09:00:00.000Z',
          scheduledEndAt: '2026-01-01T09:03:00.000Z',
          estimatedStartAt: '2026-01-01T09:00:00.000Z',
          estimatedEndAt: '2026-01-01T09:03:00.000Z',
          status: 'upcoming',
          delayMinutes: 0,
          isDelayed: false,
        },
      },
      {
        id: 'cat::bout-3',
        matchNumber: 3,
        scheduleDisplayNumber: '1-23',
        schedulePosition: 23,
        matId: '1',
        matNumber: 1,
        isFrozen: false,
        isInEditableZone: true,
        isNextStartable: false,
        matIndex: 1,
        categoryKey: 'cat',
        categoryTitle: 'Cat',
        discipline: 'd',
        competitionStage: 1,
        schedulePhase: 'final',
        sideA: { kind: 'athlete', entryId: 'c', displayName: 'C', clubName: '', city: '', publicNumber: null },
        sideB: {
          kind: 'hint',
          label: 'Победитель боя 2',
          source: { matchId: 'bout-2', outcome: 'winner' },
        },
        timing: {
          durationMinutes: 3,
          scheduledStartAt: '2026-01-01T09:06:00.000Z',
          scheduledEndAt: '2026-01-01T09:09:00.000Z',
          estimatedStartAt: '2026-01-01T09:06:00.000Z',
          estimatedEndAt: '2026-01-01T09:09:00.000Z',
          status: 'upcoming',
          delayMinutes: 0,
          isDelayed: false,
        },
      },
    ])

    const resolved = applyScheduleHintLabels(mats)
    expect(resolved[0]?.bouts[1]?.sideB).toEqual({
      kind: 'hint',
      label: 'Победитель боя 1-21',
      source: { matchId: 'bout-2', outcome: 'winner' },
    })
  })

  it('replaces stale internal bout labels with schedule display numbers', () => {
    const mats = buildMat([
      {
        id: 'cat::bout-1',
        matchNumber: 1,
        scheduleDisplayNumber: '1-5',
        schedulePosition: 5,
        matId: '1',
        matNumber: 1,
        isFrozen: false,
        isInEditableZone: true,
        isNextStartable: false,
        matIndex: 1,
        categoryKey: 'cat',
        categoryTitle: 'Cat',
        discipline: 'd',
        competitionStage: 1,
        schedulePhase: 'elimination',
        label: 'Бой 1',
        sideA: { kind: 'athlete', entryId: 'a', displayName: 'A', clubName: '', city: '', publicNumber: null },
        sideB: { kind: 'athlete', entryId: 'b', displayName: 'B', clubName: '', city: '', publicNumber: null },
        timing: {
          durationMinutes: 3,
          scheduledStartAt: '2026-01-01T09:00:00.000Z',
          scheduledEndAt: '2026-01-01T09:03:00.000Z',
          estimatedStartAt: '2026-01-01T09:00:00.000Z',
          estimatedEndAt: '2026-01-01T09:03:00.000Z',
          status: 'upcoming',
          delayMinutes: 0,
          isDelayed: false,
        },
      },
    ])

    const resolved = applyScheduleHintLabels(mats)
    expect(resolved[0]?.bouts[0]?.label).toBe('Бой 1-5')
  })

  it('replaces stale hints without source from label text', () => {
    const mats = buildMat([
      {
        id: 'cat::bout-2',
        matchNumber: 2,
        scheduleDisplayNumber: '1-21',
        schedulePosition: 21,
        matId: '1',
        matNumber: 1,
        isFrozen: false,
        isInEditableZone: true,
        isNextStartable: false,
        matIndex: 1,
        categoryKey: 'cat',
        categoryTitle: 'Cat',
        discipline: 'd',
        competitionStage: 1,
        schedulePhase: 'elimination',
        sideA: { kind: 'athlete', entryId: 'x', displayName: 'X', clubName: '', city: '', publicNumber: null },
        sideB: { kind: 'athlete', entryId: 'y', displayName: 'Y', clubName: '', city: '', publicNumber: null },
        timing: {
          durationMinutes: 3,
          scheduledStartAt: '2026-01-01T09:03:00.000Z',
          scheduledEndAt: '2026-01-01T09:06:00.000Z',
          estimatedStartAt: '2026-01-01T09:03:00.000Z',
          estimatedEndAt: '2026-01-01T09:06:00.000Z',
          status: 'upcoming',
          delayMinutes: 0,
          isDelayed: false,
        },
      },
      {
        id: 'cat::bout-1',
        matchNumber: 1,
        scheduleDisplayNumber: '1-20',
        schedulePosition: 21,
        matId: '1',
        matNumber: 1,
        isFrozen: false,
        isInEditableZone: true,
        isNextStartable: false,
        matIndex: 1,
        categoryKey: 'cat',
        categoryTitle: 'Cat',
        discipline: 'd',
        competitionStage: 1,
        schedulePhase: 'elimination',
        sideA: { kind: 'athlete', entryId: 'a', displayName: 'A', clubName: '', city: '', publicNumber: null },
        sideB: { kind: 'athlete', entryId: 'b', displayName: 'B', clubName: '', city: '', publicNumber: null },
        timing: {
          durationMinutes: 3,
          scheduledStartAt: '2026-01-01T09:00:00.000Z',
          scheduledEndAt: '2026-01-01T09:03:00.000Z',
          estimatedStartAt: '2026-01-01T09:00:00.000Z',
          estimatedEndAt: '2026-01-01T09:03:00.000Z',
          status: 'upcoming',
          delayMinutes: 0,
          isDelayed: false,
        },
      },
      {
        id: 'cat::bout-3',
        matchNumber: 3,
        scheduleDisplayNumber: '1-23',
        schedulePosition: 23,
        matId: '1',
        matNumber: 1,
        isFrozen: false,
        isInEditableZone: true,
        isNextStartable: false,
        matIndex: 1,
        categoryKey: 'cat',
        categoryTitle: 'Cat',
        discipline: 'd',
        competitionStage: 1,
        schedulePhase: 'final',
        sideA: { kind: 'athlete', entryId: 'c', displayName: 'C', clubName: '', city: '', publicNumber: null },
        sideB: {
          kind: 'hint',
          label: 'Победитель боя 2',
        },
        timing: {
          durationMinutes: 3,
          scheduledStartAt: '2026-01-01T09:06:00.000Z',
          scheduledEndAt: '2026-01-01T09:09:00.000Z',
          estimatedStartAt: '2026-01-01T09:06:00.000Z',
          estimatedEndAt: '2026-01-01T09:09:00.000Z',
          status: 'upcoming',
          delayMinutes: 0,
          isDelayed: false,
        },
      },
    ])

    const resolved = applyScheduleHintLabels(mats)
    const finalBout = resolved[0]?.bouts.find((bout) => bout.id === 'cat::bout-3')
    expect(finalBout?.sideB).toEqual({
      kind: 'hint',
      label: 'Победитель боя 1-21',
    })
  })
})
