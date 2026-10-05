import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../prisma'
import { updateBoutsPageSettings } from '../mutations'
import {
  cleanupBracketIntegrationData,
  ensureBracketDefaults,
  purgeBracketIntegrationState,
  seedBoutsPageSetting,
} from '../../brackets/__tests__/integration/helpers'
import { dbAvailable, useIntegrationDb } from '../../brackets/__tests__/integration/setup'

describe('schedule settings integration', () => {
  useIntegrationDb()

  beforeEach(async () => {
    if (!dbAvailable) return
    await purgeBracketIntegrationState()
    await ensureBracketDefaults()
    await seedBoutsPageSetting({ matsEnabled: true })
    await prisma.boutScheduleExecution.deleteMany()
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    if (!dbAvailable) return
    await prisma.boutScheduleExecution.deleteMany()
    await cleanupBracketIntegrationData({ generationIds: [], registrationIds: [], entryIds: [] })
  })

  it('increments scheduleVersion when matsEnabled toggles before first freeze', async () => {
    if (!dbAvailable) return

    const before = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    const result = await updateBoutsPageSettings({
      matsEnabled: false,
      expectedScheduleVersion: before.scheduleVersion,
    })

    expect(result.scheduleVersion).toBe(before.scheduleVersion + 1)
    const after = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    expect(after.matsEnabled).toBe(false)
    expect(after.scheduleVersion).toBe(before.scheduleVersion + 1)
  })

  it('rejects matsEnabled change after a bout number is frozen', async () => {
    if (!dbAvailable) return

    await prisma.boutScheduleExecution.create({
      data: {
        boutId: 'cat::bout-1',
        frozenScheduleFormatted: '1-1',
        frozenScheduleMatNumber: 1,
        frozenSchedulePosition: 1,
      },
    })

    const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })

    await expect(
      updateBoutsPageSettings({
        matsEnabled: false,
        expectedScheduleVersion: settings.scheduleVersion,
      }),
    ).rejects.toThrow(/зафиксированного номера/)
  })
})
