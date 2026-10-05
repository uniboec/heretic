import { Prisma, type PrismaClient } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { LeaseNotHeldError, LeaseStaleError } from './mat-control/errors'
import type { MatControlSessionRecord } from './mat-control/types'

type TransactionClient = Prisma.TransactionClient | PrismaClient

export const MAT_CONTROL_LEASE_TTL_MS = 90_000

function mapSession(row: {
  tournamentScopeId: string
  matIndex: number
  activeBoutId: string | null
  correctionFocusBoutId?: string | null
  revision: number
  holderToken: string | null
  holderSince: Date | null
  heartbeatAt: Date | null
  expiresAt: Date | null
}): MatControlSessionRecord {
  return {
    tournamentScopeId: row.tournamentScopeId,
    matIndex: row.matIndex,
    activeBoutId: row.activeBoutId,
    correctionFocusBoutId: row.correctionFocusBoutId ?? null,
    revision: row.revision,
    holderToken: row.holderToken,
    holderSince: row.holderSince,
    heartbeatAt: row.heartbeatAt,
    expiresAt: row.expiresAt,
  }
}

function matControlSessionWhere(matIndex: number) {
  return {
    tournamentScopeId_matIndex: {
      tournamentScopeId: TOURNAMENT_SCOPE_ID,
      matIndex,
    },
  }
}

/** Read session row without locking (for snapshot polling). */
export async function readMatControlSession(
  tx: TransactionClient,
  matIndex: number,
): Promise<MatControlSessionRecord> {
  const row = await tx.matControlSession.findUnique({
    where: matControlSessionWhere(matIndex),
  })
  if (!row) {
    return ensureMatControlSession(tx, matIndex)
  }
  return mapSession(row)
}

export async function ensureMatControlSession(
  tx: TransactionClient,
  matIndex: number,
): Promise<MatControlSessionRecord> {
  const where = matControlSessionWhere(matIndex)

  const existing = await tx.matControlSession.findUnique({ where })
  if (existing) {
    return mapSession(existing)
  }

  try {
    const row = await tx.matControlSession.create({
      data: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        matIndex,
      },
    })
    return mapSession(row)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const row = await tx.matControlSession.findUniqueOrThrow({ where })
      return mapSession(row)
    }
    throw error
  }
}

export async function acquireMatControlSession(input: {
  tx: TransactionClient
  matIndex: number
  holderToken: string
  now: Date
}): Promise<MatControlSessionRecord> {
  const session = await ensureMatControlSession(input.tx, input.matIndex)

  if (
    session.holderToken &&
    session.expiresAt &&
    session.expiresAt.getTime() > input.now.getTime() &&
    session.holderToken !== input.holderToken
  ) {
    throw new LeaseNotHeldError('Ковёр уже занят другим оператором')
  }

  const expiresAt = new Date(input.now.getTime() + MAT_CONTROL_LEASE_TTL_MS)
  const updated = await input.tx.matControlSession.update({
    where: {
      tournamentScopeId_matIndex: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        matIndex: input.matIndex,
      },
    },
    data: {
      holderToken: input.holderToken,
      holderSince: session.holderToken === input.holderToken ? session.holderSince : input.now,
      heartbeatAt: input.now,
      expiresAt,
      revision: { increment: 1 },
    },
  })

  return mapSession(updated)
}

export async function heartbeatMatControlSession(input: {
  tx: TransactionClient
  matIndex: number
  holderToken: string
  now: Date
}): Promise<MatControlSessionRecord> {
  const session = await ensureMatControlSession(input.tx, input.matIndex)
  assertMatControlLease(session, input.holderToken, input.now)

  const updated = await input.tx.matControlSession.update({
    where: {
      tournamentScopeId_matIndex: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        matIndex: input.matIndex,
      },
    },
    data: {
      heartbeatAt: input.now,
      expiresAt: new Date(input.now.getTime() + MAT_CONTROL_LEASE_TTL_MS),
    },
  })

  return mapSession(updated)
}

export async function releaseMatControlSession(input: {
  tx: TransactionClient
  matIndex: number
  holderToken: string
  now: Date
}): Promise<MatControlSessionRecord> {
  const session = await ensureMatControlSession(input.tx, input.matIndex)
  assertMatControlLease(session, input.holderToken, input.now)

  const updated = await input.tx.matControlSession.update({
    where: {
      tournamentScopeId_matIndex: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        matIndex: input.matIndex,
      },
    },
    data: {
      holderToken: null,
      holderSince: null,
      heartbeatAt: null,
      expiresAt: null,
      revision: { increment: 1 },
    },
  })

  return mapSession(updated)
}

export async function takeoverMatControlSession(input: {
  tx: TransactionClient
  matIndex: number
  holderToken: string
  now: Date
}): Promise<MatControlSessionRecord> {
  await ensureMatControlSession(input.tx, input.matIndex)

  const expiresAt = new Date(input.now.getTime() + MAT_CONTROL_LEASE_TTL_MS)
  const updated = await input.tx.matControlSession.update({
    where: {
      tournamentScopeId_matIndex: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        matIndex: input.matIndex,
      },
    },
    data: {
      holderToken: input.holderToken,
      holderSince: input.now,
      heartbeatAt: input.now,
      expiresAt,
      revision: { increment: 1 },
    },
  })

  return mapSession(updated)
}

export function assertMatControlLease(
  session: MatControlSessionRecord,
  holderToken: string,
  now: Date,
): void {
  if (!session.holderToken || session.holderToken !== holderToken) {
    throw new LeaseNotHeldError()
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now.getTime()) {
    throw new LeaseStaleError()
  }
}

export async function lockMatControlSessionForUpdate(
  tx: TransactionClient,
  matIndex: number,
): Promise<MatControlSessionRecord> {
  const rows = await tx.$queryRaw<
    Array<{
      tournamentScopeId: string
      matIndex: number
      activeBoutId: string | null
      revision: number
      holderToken: string | null
      holderSince: Date | null
      heartbeatAt: Date | null
      expiresAt: Date | null
    }>
  >`
    SELECT *
    FROM "MatControlSession"
    WHERE "tournamentScopeId" = ${TOURNAMENT_SCOPE_ID}
      AND "matIndex" = ${matIndex}
    FOR UPDATE
  `

  if (rows.length === 0) {
    return ensureMatControlSession(tx, matIndex)
  }

  return mapSession(rows[0]!)
}

export async function reconcileMatControlSessionsAfterScheduleChange(
  tx: TransactionClient,
  input: {
    matCount: number
    boutIdToMatIndex: ReadonlyMap<string, number>
  },
): Promise<void> {
  const sessions = await tx.matControlSession.findMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
  })

  for (const session of sessions) {
    if (session.matIndex > input.matCount) {
      await tx.matControlSession.delete({
        where: {
          tournamentScopeId_matIndex: {
            tournamentScopeId: TOURNAMENT_SCOPE_ID,
            matIndex: session.matIndex,
          },
        },
      })
      continue
    }

    if (!session.activeBoutId) {
      continue
    }

    const expectedMatIndex = input.boutIdToMatIndex.get(session.activeBoutId)
    if (expectedMatIndex !== session.matIndex) {
      await tx.matControlSession.update({
        where: {
          tournamentScopeId_matIndex: {
            tournamentScopeId: TOURNAMENT_SCOPE_ID,
            matIndex: session.matIndex,
          },
        },
        data: {
          activeBoutId: null,
          correctionFocusBoutId: null,
          revision: { increment: 1 },
        },
      })
    }
  }
}

export async function updateMatControlSession(
  tx: TransactionClient,
  matIndex: number,
  data: Prisma.MatControlSessionUpdateInput,
): Promise<MatControlSessionRecord> {
  const updated = await tx.matControlSession.update({
    where: {
      tournamentScopeId_matIndex: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        matIndex,
      },
    },
    data,
  })
  return mapSession(updated)
}
