import { describe, expect, it } from 'vitest'
import { prisma } from '../../prisma'
import { cleanupEmptyExecutionsIfNotStarted } from '../executionGuards'
import { dbAvailable, useIntegrationDb } from '../../brackets/__tests__/integration/setup'
import { seedBoutsPageSetting } from '../../brackets/__tests__/integration/helpers'

describe('scheduler empty execution cleanup integration', () => {
  useIntegrationDb()

  it('deletes orphan empty execution rows in write tx before first START', async () => {
    if (!dbAvailable) return

    await seedBoutsPageSetting()
    await prisma.boutScheduleExecution.deleteMany()
    await prisma.boutScheduleExecution.createMany({
      data: [
        { boutId: 'orphan-empty-1' },
        { boutId: 'orphan-empty-2' },
      ],
    })

    await prisma.$transaction(async (tx) => {
      const executions = await tx.boutScheduleExecution.findMany()
      const deleted = await cleanupEmptyExecutionsIfNotStarted(
        tx,
        executions.map((row) => ({
          boutId: row.boutId,
          actualStartAt: row.actualStartAt,
          actualEndAt: row.actualEndAt,
        })),
      )
      expect(deleted).toBe(2)
    })

    expect(await prisma.boutScheduleExecution.count()).toBe(0)
  })
})
