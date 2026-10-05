import { describe, expect, it } from 'vitest'
import { prisma } from '../../prisma'
import { dbAvailable, useIntegrationDb } from '../../brackets/__tests__/integration/setup'
import { seedBoutsPageSetting } from '../../brackets/__tests__/integration/helpers'

describe('competition stage integration', () => {
  useIntegrationDb()

  it('persists competitionStageSettings on bouts page settings', async () => {
    if (!dbAvailable) return

    await seedBoutsPageSetting()
    const payload = {
      breaksAfterStageMinutes: { '1': 5 },
      notBeforeStartTimes: { '2': '12:00' },
    }
    await prisma.boutsPageSetting.update({
      where: { id: 'default' },
      data: { competitionStageSettings: payload },
    })

    const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    expect(settings.competitionStageSettings).toEqual(payload)
  })
})
