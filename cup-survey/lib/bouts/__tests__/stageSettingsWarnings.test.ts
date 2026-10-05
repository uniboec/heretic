import { describe, expect, it } from 'vitest'
import { buildStageSettingsWarnings } from '../stageSettingsWarnings'
import type { StageTimingSummary } from '../scheduleTypes'

describe('buildStageSettingsWarnings', () => {
  const summaries: StageTimingSummary[] = [
    {
      stage: 1,
      plannedStartAt: '2026-10-03T05:00:00.000Z',
      estimatedStartAt: '2026-10-03T05:00:00.000Z',
      delayMinutes: 0,
      isDelayed: false,
      gapAfterPreviousMinutes: 0,
    },
    {
      stage: 2,
      plannedStartAt: '2026-10-03T08:10:00.000Z',
      estimatedStartAt: '2026-10-03T08:10:00.000Z',
      delayMinutes: 0,
      isDelayed: false,
      gapAfterPreviousMinutes: 10,
    },
  ]

  it('warns when notBefore(2) is earlier than planned stage 2 start', () => {
    const warnings = buildStageSettingsWarnings({
      stageSettings: {
        breaksAfterStageMinutes: { '1': 10 },
        notBeforeStartTimes: { '2': '11:00' },
      },
      stageSummaries: summaries,
      eventDate: '2026-10-03',
      draftNotBefore: { '2': '11:00' },
    })

    expect(warnings.some((warning) => warning.stage === 2)).toBe(true)
    expect(warnings[0]?.kind).toBe('not_before_before_prev_stage_end')
  })

  it('ignores partial notBefore input while typing', () => {
    const warnings = buildStageSettingsWarnings({
      stageSettings: {
        breaksAfterStageMinutes: { '1': 10 },
        notBeforeStartTimes: { '2': '13:00' },
      },
      stageSummaries: summaries,
      eventDate: '2026-10-03',
      draftNotBefore: { '2': '1' },
    })

    expect(warnings).toEqual([])
  })

  it('warns when notBefore(3) is earlier than notBefore(2)', () => {
    const warnings = buildStageSettingsWarnings({
      stageSettings: {
        breaksAfterStageMinutes: {},
        notBeforeStartTimes: { '2': '13:00', '3': '12:00' },
      },
      stageSummaries: [
        ...summaries,
        {
          stage: 3,
          plannedStartAt: '2026-10-03T09:00:00.000Z',
          estimatedStartAt: '2026-10-03T09:00:00.000Z',
          delayMinutes: 0,
          isDelayed: false,
          gapAfterPreviousMinutes: 10,
        },
      ],
      eventDate: '2026-10-03',
      draftNotBefore: { '2': '13:00', '3': '12:00' },
    })

    expect(
      warnings.some(
        (warning) =>
          warning.stage === 3 && warning.kind === 'not_before_before_previous_not_before',
      ),
    ).toBe(true)
  })
})
