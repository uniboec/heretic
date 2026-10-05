import { z } from 'zod'

const localTimeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

export const AwardsSettingsPatchSchema = z.object({
  publicEnabled: z.boolean().optional(),
  ceremonyStartTime: z.string().regex(localTimeRegex, 'Invalid time format HH:mm').optional(),
  ceremonyDurationMinutes: z.number().int().min(1).optional(),
  ceremonyBreakMinutes: z.number().int().min(0).optional(),
})

export const PlacementStatusPatchSchema = z.object({
  operationId: z.string().min(1),
  expectedRevision: z.number().int().min(0),
  status: z.enum(['AWARDED', 'NOT_AWARDED', 'PENDING']),
})

export const BulkCompleteSchema = z.object({
  operationId: z.string().min(1),
  queueId: z.string().min(1),
  expectedRevision: z.number().int().min(0),
})

export const QueueReorderSchema = z.object({
  operationId: z.string().min(1),
  queueId: z.string().min(1),
  action: z.enum(['moveUp', 'moveDown', 'moveToEnd', 'moveToNormal']),
  expectedQueueRevision: z.number().int().min(0),
})

export const CategoryCommentPatchSchema = z.object({
  operationId: z.string().min(1),
  queueId: z.string().min(1),
  expectedRevision: z.number().int().min(0),
  adminComment: z.string().nullable().optional(),
  publicComment: z.string().nullable().optional(),
})

export const AwardAnnouncerCallSchema = z
  .object({
    queueId: z.string().min(1),
    kind: z.enum(['category_call', 'category_prepare', 'placement']),
    placementId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'placement' && !value.placementId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'placementId is required for placement repeat calls',
        path: ['placementId'],
      })
    }
  })

export const PlacementCommentPatchSchema = z.object({
  operationId: z.string().min(1),
  expectedRevision: z.number().int().min(0),
  adminComment: z.string().nullable().optional(),
  publicComment: z.string().nullable().optional(),
})
