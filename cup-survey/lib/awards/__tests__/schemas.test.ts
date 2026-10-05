import { describe, expect, it } from 'vitest'
import {
  AwardAnnouncerCallSchema,
  AwardsSettingsPatchSchema,
  BulkCompleteSchema,
  PlacementCommentPatchSchema,
  PlacementStatusPatchSchema,
  QueueReorderSchema,
} from '../schemas'

describe('AwardsSettingsPatchSchema', () => {
  it('accepts valid timing patch', () => {
    const parsed = AwardsSettingsPatchSchema.safeParse({
      ceremonyStartTime: '11:30',
      ceremonyDurationMinutes: 3,
      ceremonyBreakMinutes: 0,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid time and duration', () => {
    expect(AwardsSettingsPatchSchema.safeParse({ ceremonyStartTime: '25:00' }).success).toBe(false)
    expect(AwardsSettingsPatchSchema.safeParse({ ceremonyDurationMinutes: 0 }).success).toBe(false)
    expect(AwardsSettingsPatchSchema.safeParse({ ceremonyBreakMinutes: -1 }).success).toBe(false)
  })
})

describe('mutation schemas', () => {
  it('validates placement status patch', () => {
    expect(
      PlacementStatusPatchSchema.safeParse({
        operationId: 'op-1',
        expectedRevision: 0,
        status: 'AWARDED',
      }).success,
    ).toBe(true)
    expect(
      PlacementStatusPatchSchema.safeParse({
        operationId: 'op-2',
        expectedRevision: 1,
        status: 'PENDING',
      }).success,
    ).toBe(true)
  })

  it('validates bulk complete and reorder', () => {
    expect(
      BulkCompleteSchema.safeParse({
        operationId: 'op-1',
        queueId: 'q-1',
        expectedRevision: 2,
      }).success,
    ).toBe(true)
    expect(
      QueueReorderSchema.safeParse({
        operationId: 'op-1',
        queueId: 'q-1',
        action: 'moveToEnd',
        expectedQueueRevision: 5,
      }).success,
    ).toBe(true)
  })

  it('validates announcer repeat call payload', () => {
    expect(
      AwardAnnouncerCallSchema.safeParse({
        queueId: 'q-1',
        kind: 'category_call',
      }).success,
    ).toBe(true)
    expect(
      AwardAnnouncerCallSchema.safeParse({
        queueId: 'q-1',
        kind: 'placement',
        placementId: 'p-1',
      }).success,
    ).toBe(true)
    expect(
      AwardAnnouncerCallSchema.safeParse({
        queueId: 'q-1',
        kind: 'placement',
      }).success,
    ).toBe(false)
  })

  it('validates placement comment patch', () => {
    expect(
      PlacementCommentPatchSchema.safeParse({
        operationId: 'op-1',
        expectedRevision: 1,
        adminComment: 'уехал',
      }).success,
    ).toBe(true)
  })
})
