/**
 * E: structure preview load should stay responsive for a typical category.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { getAdminBracketCategoryStructure } from '../../service'
import {
  cleanupBracketIntegrationData,
  preparePublishableDraft,
  resetRegistrationRevision,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('admin category structure render perf', () => {
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

  it('loads DRAFT structure within CI-safe budget', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: prepared.draft.id, status: 'ACTIVE' },
    })
    expect(draw).toBeTruthy()

    const started = performance.now()
    const structure = await getAdminBracketCategoryStructure(draw!.categoryKey)
    const elapsedMs = performance.now() - started

    expect(structure).toBeTruthy()
    expect(structure!.structure).toBeTruthy()
    expect(elapsedMs).toBeLessThan(Number(process.env.BRACKET_STRUCTURE_PERF_MS ?? 1500))
  })
})
