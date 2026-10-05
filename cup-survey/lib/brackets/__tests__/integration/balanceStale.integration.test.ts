import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { getAdminBracketsDashboard } from '../../service'
import {
  cleanupBracketIntegrationData,
  preparePublishableDraft,
  resetRegistrationRevision,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('balanceStale integration', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  afterEach(async () => {
    if (!dbAvailable) return
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
    await resetRegistrationRevision()
  })

  it('marks category balanceStale after club change in registration', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: prepared.draft.id, status: 'ACTIVE' },
      include: { participants: true },
    })
    const participant = draw!.participants[0]

    const registration = await prisma.teamRegistration.findFirst({
      where: {
        athletes: {
          some: {
            entries: { some: { id: participant.entryId } },
          },
        },
      },
    })
    expect(registration).toBeTruthy()

    await prisma.teamRegistration.update({
      where: { id: registration!.id },
      data: { clubName: `Changed Club ${Date.now()}` },
    })

    const dashboard = await getAdminBracketsDashboard()
    const category = dashboard.categories.find((item) => item.categoryKey === draw!.categoryKey)
    expect(category?.balanceStale).toBe(true)
  })

  it('marks category balanceStale after athlete rank change in registration', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: prepared.draft.id, status: 'ACTIVE' },
      include: { participants: true },
    })
    const participant = draw!.participants[0]

    const athlete = await prisma.athlete.findFirst({
      where: {
        entries: { some: { id: participant.entryId } },
      },
    })
    expect(athlete).toBeTruthy()

    await prisma.athlete.update({
      where: { id: athlete!.id },
      data: { rank: 'msmk' },
    })

    const dashboard = await getAdminBracketsDashboard()
    const category = dashboard.categories.find((item) => item.categoryKey === draw!.categoryKey)
    expect(category?.balanceStale).toBe(true)
  })
})
