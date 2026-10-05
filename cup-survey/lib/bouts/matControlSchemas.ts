import { z } from 'zod'

export const BoutReliabilityEnvelopeSchema = z.object({
  boutSessionId: z.string().uuid(),
  clientSessionId: z.string().uuid(),
  ownershipEpoch: z.number().int().positive(),
  sequenceNo: z.number().int().positive(),
  payloadHash: z.string().min(64).max(64),
})

export const BoutMutationEnvelopeSchema = z.object({
  operationId: z.string().uuid(),
  holderToken: z.string().min(1),
  expectedLiveRevision: z.number().int().min(0),
  expectedAttemptNumber: z.number().int().min(1),
  expectedScheduleVersion: z.number().int().min(0).optional(),
  reliability: BoutReliabilityEnvelopeSchema.optional(),
})

export const MatControlCommandSchema = BoutMutationEnvelopeSchema.extend({
  intent: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export const MatSessionAcquireSchema = z.object({
  holderToken: z.string().min(1),
})

export const MatSessionHeartbeatSchema = z.object({
  holderToken: z.string().min(1),
})

export const MatSessionReleaseSchema = z.object({
  holderToken: z.string().min(1),
})

export const MatSessionTakeoverSchema = z.object({
  holderToken: z.string().min(1),
})

export const PreviewDecisionSchema = z.object({
  period: z.enum(['main', 'extra']).optional(),
})

const CommitPackageEventSchema = z.object({
  schemaVersion: z.number().int().positive(),
  type: z.string().min(1),
  commandId: z.string().min(1),
  sequenceNo: z.number().int().positive(),
  boutElapsedMs: z.number().int().min(0),
  payload: z.record(z.string(), z.unknown()).default({}),
  eventHash: z.string().min(1),
})

export const CommitBoutPackageSchema = z.object({
  schemaVersion: z.number().int().positive(),
  boutId: z.string().min(1),
  boutSessionId: z.string().uuid(),
  clientSessionId: z.string().uuid(),
  ownershipEpoch: z.number().int().positive(),
  events: z.array(CommitPackageEventSchema),
  result: z.record(z.string(), z.unknown()),
  finalState: z.record(z.string(), z.unknown()),
  packageHash: z.string().optional(),
  checksum: z.string().optional(),
})

export const AcquireBoutSessionSchema = z.object({
  acquireRequestId: z.string().uuid(),
  clientSessionId: z.string().uuid().optional(),
})

export const BoutSessionHeartbeatSchema = z.object({
  boutSessionId: z.string().uuid(),
  clientSessionId: z.string().uuid(),
  ownershipEpoch: z.number().int().positive(),
})

export const BoutSessionHandoffSchema = z.object({
  boutSessionId: z.string().uuid(),
  newClientSessionId: z.string().uuid(),
  reason: z.string().min(1),
  suffixDisposition: z.enum(['SYNCED', 'DISCARDED', 'UNKNOWN_FORCE_TAKEOVER']),
})

export const BoutSessionReclaimSchema = z.object({
  boutSessionId: z.string().uuid(),
  status: z.enum(['EXPIRED', 'CANCELLED']),
  reason: z.string().min(1),
})
