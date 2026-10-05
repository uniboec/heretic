import type { Prisma } from '@prisma/client'

export async function recordAutoSyncSuccess(
  tx: Prisma.TransactionClient,
  input: {
    operationId: string
    generationId: string
    categoryKey: string
    revision: bigint
  },
) {
  await tx.bracketAutoSyncEvent.create({
    data: {
      operationId: input.operationId,
      generationId: input.generationId,
      categoryKey: input.categoryKey,
      revision: input.revision,
      success: true,
    },
  })
}

export async function recordAutoSyncFailure(input: {
  operationId: string
  generationId: string
  categoryKeys: string[]
  revision?: bigint | null
  errorMessage: string
}) {
  const { prisma } = await import('../../prisma')
  for (const categoryKey of input.categoryKeys) {
    await prisma.bracketAutoSyncEvent.create({
      data: {
        operationId: input.operationId,
        generationId: input.generationId,
        categoryKey,
        revision: input.revision ?? null,
        success: false,
        errorMessage: input.errorMessage,
      },
    })
  }
}

export async function getUnresolvedAutoSyncFailures(generationId: string) {
  const { prisma } = await import('../../prisma')
  const events = await prisma.bracketAutoSyncEvent.findMany({
    where: { generationId },
    orderBy: { createdAt: 'desc' },
  })

  const lastSuccessByCategory = new Map<string, Date>()
  const unresolved: Array<{
    categoryKey: string
    errorMessage: string | null
    createdAt: Date
  }> = []

  for (const event of events) {
    if (event.success) {
      if (!lastSuccessByCategory.has(event.categoryKey)) {
        lastSuccessByCategory.set(event.categoryKey, event.createdAt)
      }
      continue
    }

    const lastSuccess = lastSuccessByCategory.get(event.categoryKey)
    if (!lastSuccess || event.createdAt > lastSuccess) {
      if (!unresolved.some((item) => item.categoryKey === event.categoryKey)) {
        unresolved.push({
          categoryKey: event.categoryKey,
          errorMessage: event.errorMessage,
          createdAt: event.createdAt,
        })
      }
    }
  }

  return unresolved
}

/** @deprecated use generationId */
export async function getUnresolvedAutoSyncFailuresByDraftId(draftGenerationId: string) {
  return getUnresolvedAutoSyncFailures(draftGenerationId)
}
