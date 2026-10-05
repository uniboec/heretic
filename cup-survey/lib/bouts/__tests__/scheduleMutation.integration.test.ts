import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../prisma'
import { executeScheduleMutation } from '../executeScheduleMutation'
import { computeScheduleMutationFingerprint } from '../scheduleMutation'
import { ensureBracketDefaults, seedBoutsPageSetting } from '../../brackets/__tests__/integration/helpers'
import { dbAvailable, useIntegrationDb } from '../../brackets/__tests__/integration/setup'

async function purgeScheduleMutationLogs() {
  await prisma.scheduleMutationLog.deleteMany()
}

describe('scheduleMutation integration', () => {
  useIntegrationDb()

  beforeEach(async () => {
    if (!dbAvailable) return
    await purgeScheduleMutationLogs()
    await ensureBracketDefaults()
    await seedBoutsPageSetting()
    await prisma.boutsPageSetting.update({
      where: { id: 'default' },
      data: { scheduleVersion: 5 },
    })
  })

  afterEach(async () => {
    if (!dbAvailable) return
    await purgeScheduleMutationLogs()
  })

  it('deduplicates concurrent mutationId into a single version bump', async () => {
    if (!dbAvailable) return

    const mutationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    let executeCount = 0

    const run = () =>
      executeScheduleMutation({
        mutationId,
        boutId: 'cat::bout-1',
        command: 'TEST_FREEZE',
        payload: { marker: 1 },
        actorId: 'integration-admin',
        expectedScheduleVersion: 5,
        execute: async () => {
          executeCount += 1
          await new Promise((resolve) => setTimeout(resolve, 75))
          return { result: { ok: true }, changed: true }
        },
      })

    const [first, second] = await Promise.all([run(), run()])

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(executeCount).toBe(1)
    expect([first.replayed, second.replayed]).toContain(true)

    const settings = await prisma.boutsPageSetting.findUniqueOrThrow({
      where: { id: 'default' },
    })
    expect(settings.scheduleVersion).toBe(6)

    const log = await prisma.scheduleMutationLog.findUniqueOrThrow({
      where: { mutationId },
    })
    expect(log.status).toBe('SUCCESS')
    expect(log.committedScheduleVersion).toBe(6)
    expect(log.leaseUntil).toBeNull()
    expect(log.ownerToken).toBeNull()
  })

  it('replays SUCCESS after lease takeover on stale pending mutation', async () => {
    if (!dbAvailable) return

    const mutationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const fingerprint = computeScheduleMutationFingerprint({
      mutationId,
      boutId: 'cat::bout-2',
      command: 'TEST_FREEZE',
      payload: { marker: 2 },
    })

    await prisma.scheduleMutationLog.create({
      data: {
        mutationId,
        status: 'PENDING',
        requestFingerprint: fingerprint,
        boutId: 'cat::bout-2',
        command: 'TEST_FREEZE',
        actorId: 'stale-owner',
        ownerToken: 'stale-token',
        leaseUntil: new Date(Date.now() - 5_000),
      },
    })

    const response = await executeScheduleMutation({
      mutationId,
      boutId: 'cat::bout-2',
      command: 'TEST_FREEZE',
      payload: { marker: 2 },
      actorId: 'integration-admin',
      expectedScheduleVersion: 5,
      execute: async () => ({ result: { ok: true }, changed: true }),
    })

    expect(response.replayed).toBe(false)
    expect(response.committedScheduleVersion).toBe(6)

    const log = await prisma.scheduleMutationLog.findUniqueOrThrow({
      where: { mutationId },
    })
    expect(log.status).toBe('SUCCESS')
    expect(log.leaseUntil).toBeNull()
  })

  it('prevents split-brain between frozen business state and mutation log', async () => {
    if (!dbAvailable) return

    const mutationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const boutId = 'cat::split-brain-bout'

    await prisma.boutScheduleExecution.create({
      data: {
        boutId,
        boutPhase: 'scheduled',
      },
    })

    const response = await executeScheduleMutation({
      mutationId,
      boutId,
      command: 'TEST_MARK_FROZEN',
      payload: {},
      actorId: 'integration-admin',
      expectedScheduleVersion: 5,
      execute: async (tx) => {
        await tx.boutScheduleExecution.update({
          where: { boutId },
          data: {
            frozenScheduleFormatted: '1-1',
            frozenScheduleMatNumber: 1,
            frozenSchedulePosition: 1,
          },
        })
        return { result: { scheduleDisplayNumber: '1-1' }, changed: true }
      },
    })

    expect(response.success).toBe(true)

    const [execution, log] = await Promise.all([
      prisma.boutScheduleExecution.findUniqueOrThrow({ where: { boutId } }),
      prisma.scheduleMutationLog.findUniqueOrThrow({ where: { mutationId } }),
    ])

    expect(execution.frozenScheduleFormatted).toBe('1-1')
    expect(log.status).toBe('SUCCESS')
    expect(log.leaseUntil).toBeNull()
  })
})
