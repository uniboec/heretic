import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { prisma } from '../../../prisma'
import { assertPublishedSystemVersionsAvailable } from '../../deployGuard'
import { cleanupBracketIntegrationData } from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('deploy guard integration', () => {
  const generationIds: string[] = []

  useIntegrationDb()

  afterEach(async () => {
    if (!dbAvailable) return
    await cleanupBracketIntegrationData({ generationIds })
    generationIds.length = 0
  })

  it('fails when published ACTIVE draw references missing system version', async () => {
    const published = await prisma.bracketGeneration.create({
      data: {
        status: 'ACTIVE',
        singletonKey: 'live',
        baseSeed: randomUUID(),
        version: 1,
        publishedAt: new Date(),
        categories: {
          create: {
            categoryKey: 'test:cat',
            discipline: 'test',
            title: 'Test',
            status: 'ACTIVE',
            autoSystemId: 'olympic',
            systemVersion: 999,
            drawSeed: 'seed',
            redrawRevision: 0,
          },
        },
      },
      include: { categories: true },
    })
    generationIds.push(published.id)

    await expect(assertPublishedSystemVersionsAvailable()).rejects.toThrow(
      /Missing bracket system olympic v999/,
    )
  })
})
