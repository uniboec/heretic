import { Prisma } from '@prisma/client'

/** Mat-control loads full schedule snapshots and may wait on row locks during live ops. */
export const MAT_CONTROL_TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 30_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
} as const

/** ReadCommitted: snapshot polls must not use row locks that conflict with lease/focus writes. */
export const MAT_CONTROL_SNAPSHOT_TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 30_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
} as const
