import { describe, expect, it } from 'vitest'
import { prisma } from '../../prisma'
import { BoutsPageSettingMissingError } from '../errors'
import { getBoutsPageSettings } from '../service'
import { lockBoutsPageSetting } from '../locks'
import { dbAvailable, useIntegrationDb } from '../../brackets/__tests__/integration/setup'
import { seedBoutsPageSetting } from '../../brackets/__tests__/integration/helpers'

describe('lockBoutsPageSetting', () => {
  useIntegrationDb()

  it('locks existing default BoutsPageSetting row without mutating marker/mode', async () => {
    if (!dbAvailable) return

    await seedBoutsPageSetting()

    await prisma.$transaction(async (tx) => {
      const locked = await lockBoutsPageSetting(tx)
      expect(locked.autoMatAssignMode).toBe('BY_CATEGORY')
      expect(locked.autoMatByCategoryEnabled).toBe(true)
    })
  })

  it('throws BoutsPageSettingMissingError when singleton is missing', async () => {
    if (!dbAvailable) return

    await prisma.boutsPageSetting.deleteMany()

    await expect(
      prisma.$transaction(async (tx) => lockBoutsPageSetting(tx)),
    ).rejects.toBeInstanceOf(BoutsPageSettingMissingError)
  })
})

describe('getBoutsPageSettings', () => {
  useIntegrationDb()

  it('throws BoutsPageSettingMissingError when singleton is missing', async () => {
    if (!dbAvailable) return

    await prisma.boutsPageSetting.deleteMany()

    await expect(getBoutsPageSettings()).rejects.toBeInstanceOf(BoutsPageSettingMissingError)
  })
})
