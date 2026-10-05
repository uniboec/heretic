import { z } from 'zod'
import { isValidLocalTime } from './startTimes'
import { fseAgeDivisions } from '../config/fseCategories'
import { MAX_COMPETITION_STAGE } from './competitionStages'
import { MAX_BREAK_AFTER_STAGE_MINUTES } from './competitionStageSettings'
import {
  AGE_DIVISION_DURATION_MAX,
  AGE_DIVISION_DURATION_MIN,
  ATHLETE_SPACING_BOUT_COUNT_MAX,
  ATHLETE_SPACING_BOUT_COUNT_MEDAL_MIN,
  ATHLETE_SPACING_BOUT_COUNT_REGULAR_MIN,
  ATHLETE_SPACING_TIME_MAX_MINUTES,
  BOUT_BREAK_MINUTES_MAX,
  BOUT_BREAK_MINUTES_MIN,
  MAT_COUNT_MAX,
  MAT_COUNT_MIN,
} from './settingsLimits'
import { validateAthleteParticipationSpacingPatch } from './athleteParticipationSpacing'

const HH_MM_SCHEMA = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Время должно быть в формате HH:mm')
  .refine(isValidLocalTime)

const MatStartTimeOverridesPatchSchema = z
  .object({
    '1': HH_MM_SCHEMA,
    '2': HH_MM_SCHEMA,
    '3': HH_MM_SCHEMA,
  })
  .partial()
  .strict()

const MatStartTimeOverridesResponseSchema = z
  .object({
    '1': HH_MM_SCHEMA.optional(),
    '2': HH_MM_SCHEMA.optional(),
    '3': HH_MM_SCHEMA.optional(),
  })
  .strict()
  .transform((value) => {
    const result: Partial<Record<'1' | '2' | '3', string>> = {}
    for (const key of ['1', '2', '3'] as const) {
      const entry = value[key]
      if (entry !== undefined) {
        result[key] = entry
      }
    }
    return result
  })

const AgeDivisionDurationOverridesResponseSchema = z.record(z.string(), z.number())

const AgeDivisionDurationOverridesPatchSchema = z
  .record(
    z.enum(fseAgeDivisions.map((division) => division.id) as [string, ...string[]]),
    z.number().int().min(AGE_DIVISION_DURATION_MIN).max(AGE_DIVISION_DURATION_MAX),
  )
  .optional()

export const BoutLiveScoreSchema = z
  .object({
    red: z.number(),
    blue: z.number(),
    periodRemainingMs: z.number().optional(),
    boutPhase: z.string().optional(),
    currentPeriod: z.enum(['main', 'extra']).optional(),
  })
  .strict()

export const BoutTimingSchema = z
  .object({
    durationMinutes: z.number(),
    scheduledStartAt: z.string().datetime(),
    scheduledEndAt: z.string().datetime(),
    estimatedStartAt: z.string().datetime(),
    estimatedEndAt: z.string().datetime(),
    actualStartAt: z.string().datetime().optional(),
    actualEndAt: z.string().datetime().optional(),
    status: z.enum(['upcoming', 'in_progress', 'completed']),
    displayStatus: z.enum(['completed', 'in_progress', 'preparing', 'scheduled']).optional(),
    delayMinutes: z.number(),
    isDelayed: z.boolean(),
    liveScore: BoutLiveScoreSchema.optional(),
  })
  .strict()

export const PublicSlotSourceSchema = z
  .object({
    matchId: z.string(),
    outcome: z.enum(['winner', 'loser']),
  })
  .strict()

export const PublicAthleteSideSchema = z
  .object({
    kind: z.literal('athlete'),
    entryId: z.string(),
    displayName: z.string(),
    clubName: z.string(),
    city: z.string(),
    publicNumber: z.number().nullable(),
  })
  .strict()

export const PublicHintSideSchema = z
  .object({
    kind: z.literal('hint'),
    label: z.string(),
    source: PublicSlotSourceSchema.optional(),
  })
  .strict()

export const PublicByeSideSchema = z.object({ kind: z.literal('bye') }).strict()

export const PublicBoutSideSchema = z.discriminatedUnion('kind', [
  PublicAthleteSideSchema,
  PublicHintSideSchema,
  PublicByeSideSchema,
])

const CompetitionStageKeySchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_COMPETITION_STAGE)
  .transform(String)

export const CompetitionStageSettingsPatchSchema = z
  .object({
    breaksAfterStageMinutes: z
      .record(
        CompetitionStageKeySchema,
        z.number().int().min(0).max(MAX_BREAK_AFTER_STAGE_MINUTES),
      )
      .optional(),
    notBeforeStartTimes: z.record(CompetitionStageKeySchema, HH_MM_SCHEMA).optional(),
  })
  .strict()

export const CompetitionStagePatchSchema = z
  .object({
    draftId: z.string(),
    expectedVersion: z.number().int(),
    competitionStage: z.number().int().min(1).max(MAX_COMPETITION_STAGE),
  })
  .strict()

export const PublicBoutSchema = z
  .object({
    id: z.string(),
    scheduleDisplayNumber: z.string(),
    schedulePosition: z.number().int().min(1),
    matId: z.string().nullable(),
    matNumber: z.number().int().nullable(),
    isFrozen: z.boolean(),
    matIndex: z.number(),
    categoryKey: z.string(),
    categoryTitle: z.string(),
    discipline: z.string(),
    competitionStage: z.number().int().min(1).max(MAX_COMPETITION_STAGE),
    schedulePhase: z.enum(['elimination', 'bronze', 'final', 'round_robin']),
    label: z.string().optional(),
    sideA: PublicBoutSideSchema,
    sideB: PublicBoutSideSchema,
    timing: BoutTimingSchema,
    winnerEntryId: z.string().nullable().optional(),
  })
  .strict()

export const AdminScheduledBoutSchema = PublicBoutSchema.extend({
  matchNumber: z.number(),
  isInEditableZone: z.boolean(),
  isNextStartable: z.boolean(),
}).strict()

export const StageTimingSummarySchema = z
  .object({
    stage: z.number().int().min(1).max(MAX_COMPETITION_STAGE),
    notBeforeStartAt: z.string().datetime().optional(),
    plannedStartAt: z.string().datetime(),
    estimatedStartAt: z.string().datetime(),
    delayMinutes: z.number(),
    isDelayed: z.boolean(),
    gapAfterPreviousMinutes: z.number(),
  })
  .strict()

export const PublicMatSchema = z
  .object({
    matIndex: z.number(),
    configuredStartTime: z.string(),
    scheduledEndAt: z.string().datetime().nullable(),
    estimatedEndAt: z.string().datetime().nullable(),
    bouts: z.array(PublicBoutSchema),
  })
  .strict()

export const AdminMatSchema = PublicMatSchema.extend({
  bouts: z.array(AdminScheduledBoutSchema),
}).strict()

const ScheduleMetaSchema = z.object({
  scheduleVersion: z.number().int().min(0),
  matsEnabled: z.boolean(),
  scheduleLegacyGap: z.boolean(),
})

export const PublicBoutsUnpublishedSchema = z
  .object({
    published: z.literal(false),
    publishedAt: z.null(),
    generatedAt: z.string().datetime(),
    matCount: z.number(),
    mats: z.array(PublicMatSchema),
    stageSummaries: z.array(StageTimingSummarySchema).default([]),
    ...ScheduleMetaSchema.shape,
  })
  .strict()

export const PublicBoutsPublishedSchema = z
  .object({
    published: z.literal(true),
    publishedAt: z.string().datetime(),
    generatedAt: z.string().datetime(),
    matCount: z.number(),
    mats: z.array(PublicMatSchema),
    stageSummaries: z.array(StageTimingSummarySchema).default([]),
    ...ScheduleMetaSchema.shape,
  })
  .strict()

export const PublicBoutsResponseSchema = z.discriminatedUnion('published', [
  PublicBoutsUnpublishedSchema,
  PublicBoutsPublishedSchema,
])

export type PublicBoutsResponse = z.infer<typeof PublicBoutsResponseSchema>

export const AutoMatAssignModeSchema = z.enum([
  'BY_CATEGORY',
  'BY_BOUT',
  'BY_CATEGORY_TIME',
  'BY_BOUT_TIME',
])

export const AthleteParticipationSpacingPatchSchema = z
  .object({
    enabled: z.boolean(),
    mode: z.enum(['BOUT_COUNT', 'TIME']),
    regular: z.number().int().min(0).max(ATHLETE_SPACING_BOUT_COUNT_MAX),
    medal: z.number().int().min(0).max(ATHLETE_SPACING_BOUT_COUNT_MAX),
  })
  .strict()
  .superRefine((data, ctx) => {
    const error = validateAthleteParticipationSpacingPatch(data)
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error, path: ['regular'] })
    }
    if (data.enabled && data.mode === 'BOUT_COUNT') {
      if (data.regular < ATHLETE_SPACING_BOUT_COUNT_REGULAR_MIN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Минимум ${ATHLETE_SPACING_BOUT_COUNT_REGULAR_MIN} слота`,
          path: ['regular'],
        })
      }
      if (data.medal < ATHLETE_SPACING_BOUT_COUNT_MEDAL_MIN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Минимум ${ATHLETE_SPACING_BOUT_COUNT_MEDAL_MIN} слотов`,
          path: ['medal'],
        })
      }
    }
    if (data.enabled && data.mode === 'TIME') {
      if (data.regular <= 0 || data.regular > ATHLETE_SPACING_TIME_MAX_MINUTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Укажите время от 1 до 120 минут',
          path: ['regular'],
        })
      }
      if (data.medal < data.regular || data.medal > ATHLETE_SPACING_TIME_MAX_MINUTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Медальные: не меньше обычных, до 120 минут',
          path: ['medal'],
        })
      }
    }
  })

export const AthleteParticipationSpacingResponseSchema = z
  .object({
    enabled: z.boolean(),
    mode: z.enum(['BOUT_COUNT', 'TIME']),
    regular: z.number().int(),
    medal: z.number().int(),
  })
  .strict()

export const ExpectedScheduleVersionSchema = z
  .object({
    expectedScheduleVersion: z.number().int().min(0),
  })
  .strict()

export const AdminBoutsSettingsPatchBaseShape = z
  .object({
    publicEnabled: z.boolean().optional(),
    matsEnabled: z.boolean().optional(),
    expectedScheduleVersion: z.number().int().min(0).optional(),
    matCount: z.number().int().min(MAT_COUNT_MIN).max(MAT_COUNT_MAX).optional(),
    draftId: z.string().optional(),
    expectedVersion: z.number().int().optional(),
    autoMatAssignMode: AutoMatAssignModeSchema.optional(),
    autoMatByCategoryEnabled: z.boolean().optional(),
    confirmFixedDemotion: z.boolean().optional(),
    demotionToken: z.string().optional(),
    boutsStartTime: HH_MM_SCHEMA.optional(),
    matStartTimeOverrides: z.union([MatStartTimeOverridesPatchSchema, z.null(), z.object({}).strict()]).optional(),
    boutBreakMinutes: z
      .number()
      .int()
      .min(BOUT_BREAK_MINUTES_MIN)
      .max(BOUT_BREAK_MINUTES_MAX)
      .optional(),
    ageDivisionDurationOverrides: z
      .union([AgeDivisionDurationOverridesPatchSchema, z.null(), z.object({}).strict()])
      .optional(),
    pinAllFinalsToEnd: z.boolean().optional(),
    competitionStageSettings: CompetitionStageSettingsPatchSchema.optional(),
    athleteParticipationSpacing: AthleteParticipationSpacingPatchSchema.optional(),
  })
  .strict()


export const AdminBoutsSettingsPatchSchema = AdminBoutsSettingsPatchBaseShape.superRefine(
  (data, ctx) => {
    if (data.matCount !== undefined) {
      if (!data.draftId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Для изменения числа площадок укажите черновик',
          path: ['draftId'],
        })
      }
      if (data.expectedVersion === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Для изменения числа площадок укажите версию черновика',
          path: ['expectedVersion'],
        })
      }
    }

    const confirmFixed = data.confirmFixedDemotion === true
    const tokenPresent = Boolean(data.demotionToken?.length)
    const confirmAbsent =
      data.confirmFixedDemotion === undefined && data.demotionToken === undefined

    if (!confirmAbsent) {
      if (!(confirmFixed && tokenPresent)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Подтверждение demotion требует confirmFixedDemotion: true и непустой demotionToken',
          path: ['confirmFixedDemotion'],
        })
      }
      if (data.matCount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Подтверждение demotion требует поле matCount',
          path: ['matCount'],
        })
      }
    }
  },
)

export type AdminBoutsSettingsPatchInput = z.infer<typeof AdminBoutsSettingsPatchSchema>

export type MatCountChangeResult = {
  recomputedReleasedCategoryCount: number
  reassignedAutoCategoryCount: number
  demotedFixedMats: number[]
  demotedCategoryCount: number
}

export type ModeChangeResult = {
  recomputedReleasedCategoryCount: number
  reassignedAutoCategoryCount: number
}

export const MatManualOrderPatchSchema = ExpectedScheduleVersionSchema.extend({
  matIndex: z.number().int().min(1).max(3),
  orderedBoutIds: z.array(z.string()).min(1),
}).strict()

export const MatManualOrderResetSchema = ExpectedScheduleVersionSchema.extend({
  action: z.literal('reset_manual_order'),
  matIndex: z.number().int().min(1).max(3),
}).strict()

export const BoutPinPatchSchema = ExpectedScheduleVersionSchema.extend({
  action: z.literal('pin'),
  boutId: z.string(),
  pinnedToEnd: z.boolean(),
  confirmCascade: z.boolean().optional(),
}).strict()

export const BoutsBulkPinPatchSchema = ExpectedScheduleVersionSchema.extend({
  action: z.literal('pin_bulk'),
  boutIds: z.array(z.string().min(1)).min(1).max(50),
  pinnedToEnd: z.boolean(),
  confirmCascade: z.boolean().optional(),
}).strict()

export const BoutsBulkMoveMatPatchSchema = ExpectedScheduleVersionSchema.extend({
  action: z.literal('move_mat_bulk'),
  boutIds: z.array(z.string().min(1)).min(1).max(50),
  targetMatIndex: z.number().int().min(1).max(3),
}).strict()

export const BoutScheduleOverrideSchema = z
  .object({
    pinnedToEnd: z.boolean().optional(),
    manualOrder: z.number().int().min(0).optional(),
    queueAfterBoutId: z.string().min(1).optional(),
  })
  .strict()

export const AdminBoutsDashboardSchema = z
  .object({
    generatedAt: z.string().datetime(),
    scheduleVersion: z.number().int().min(0),
    matsEnabled: z.boolean(),
    scheduleLegacyGap: z.boolean(),
    eventFinalized: z.boolean().default(false),
    settings: z
      .object({
        publicEnabled: z.boolean(),
        matCount: z.number(),
        matsEnabled: z.boolean(),
        scheduleVersion: z.number().int().min(0),
        scheduleLegacyGap: z.boolean(),
        autoMatAssignMode: AutoMatAssignModeSchema,
        autoMatByCategoryEnabled: z.boolean(),
        boutsStartTime: z.string(),
        matStartTimeOverrides: MatStartTimeOverridesResponseSchema,
        boutBreakMinutes: z.number(),
        ageDivisionDurationOverrides: AgeDivisionDurationOverridesResponseSchema,
        pinAllFinalsToEnd: z.boolean(),
        competitionStageSettings: CompetitionStageSettingsPatchSchema.default({
          breaksAfterStageMinutes: {},
          notBeforeStartTimes: {},
        }),
        athleteParticipationSpacing: AthleteParticipationSpacingResponseSchema,
      })
      .strict(),
    published: z.boolean(),
    publishedAt: z.string().datetime().nullable(),
    mats: z.array(AdminMatSchema),
    scheduleOverrides: z.record(z.string(), BoutScheduleOverrideSchema),
    stageSummaries: z.array(StageTimingSummarySchema).default([]),
    groupingWarnings: z.array(
      z
        .object({
          code: z.literal('STORED_MAT_INDEX_OUT_OF_RANGE'),
          categoryKey: z.string(),
          boutId: z.string(),
          storedMatIndex: z.number(),
          matCount: z.number(),
        })
        .strict(),
    ),
  })
  .strict()

export const ScheduleMutationRequestBaseSchema = z
  .object({
    mutationId: z.string().uuid(),
    expectedScheduleVersion: z.number().int().min(0),
  })
  .strict()

export const BoutExecutionStartSchema = ScheduleMutationRequestBaseSchema.extend({
  boutId: z.string().min(1),
  matIndex: z.number().int().min(1).max(3),
}).strict()

export const BoutExecutionCompleteSchema = z
  .object({
    boutId: z.string().min(1),
    matIndex: z.number().int().min(1).max(3),
  })
  .strict()

export const CorrectHistoricalScheduleNumberSchema = z
  .object({
    boutId: z.string().min(1),
    newMatNumber: z.number().int().min(1).max(3).nullable(),
    newPosition: z.number().int().min(1),
    reason: z.string().min(1),
    expectedScheduleVersion: z.number().int().min(0),
  })
  .strict()

export const ScheduleMutationResponseSchema = z
  .object({
    success: z.literal(true),
    mutationId: z.string().uuid().optional(),
    committedScheduleVersion: z.number().int().min(0),
    scheduleVersion: z.number().int().min(0),
    replayed: z.boolean().optional(),
  })
  .strict()
