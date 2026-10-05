import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { assertIntegrationTestDatabase } from '@/lib/db/integrationDatabaseUrl'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  ensureBracketDefaults,
  publishActiveForIntegration,
  seedPaidEntry,
  syncRedrawAll,
} from '@/lib/brackets/__tests__/integration/helpers'
import { dbAvailable, useIntegrationDb } from '@/lib/brackets/__tests__/integration/setup'
import { getAdminAthleteRatings, getPublicAthleteRatings } from '../../service'
import {
  getAthleteRatingSettings,
  invalidateAthleteRatingSettingsCache,
  updateAthleteRatingSettings,
} from '../../settings'

const defaultSettingsInput = {
  publicEnabled: true,
  publicTopLimit: 10,
  firstPlacePoints: 60,
  secondPlacePoints: 35,
  thirdPlacePoints: 15,
  placeWithoutWinPercent: 20,
  pointsVictoryPoints: 32,
  clearAdvantageVictoryPoints: 36,
  submissionVictoryPoints: 40,
  chokeVictoryPoints: 40,
  injuryVictoryPoints: 20,
  dqVictoryPoints: 10,
  ageCoefficients: {
    '4-5': 35,
    '6-7': 45,
    '8-9': 60,
    '10-11': 75,
    '12-13': 88,
    '14-15': 100,
    '16-17': 105,
    '18+': 110,
  },
}

async function resetAthleteRatingSettings() {
  await prisma.athleteRatingSetting.deleteMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
  })
  invalidateAthleteRatingSettingsCache()
}

async function ensureChampionFormatRule() {
  const existing = await prisma.bracketFormatRule.findFirst({
    where: { minParticipants: 1, maxParticipants: 1, enabled: true },
  })
  if (existing) return
  await prisma.bracketFormatRule.create({
    data: {
      minParticipants: 1,
      maxParticipants: 1,
      systemId: 'champion',
      allowedSystemIds: ['champion'],
      sortOrder: -1,
      enabled: true,
    },
  })
}

describe('athlete ratings integration', () => {
  beforeEach(async () => {
    assertIntegrationTestDatabase()
    await resetAthleteRatingSettings()
  })

  it('returns defaults when settings row is missing', async () => {
    const settings = await getAthleteRatingSettings()
    expect(settings.publicEnabled).toBe(false)
    expect(settings.publicTopLimit).toBe(10)
    expect(settings.firstPlacePoints).toBe(60)
  })

  it('persists settings and recalculates admin ranking', async () => {
    const updated = await updateAthleteRatingSettings({
      ...defaultSettingsInput,
      publicTopLimit: 20,
    })

    expect(updated.publicEnabled).toBe(true)
    expect(updated.publicTopLimit).toBe(20)

    const admin = await getAdminAthleteRatings('overall')
    expect(admin.settings.publicTopLimit).toBe(20)
    expect(Array.isArray(admin.rows)).toBe(true)
  })

  it('hides public ratings when disabled', async () => {
    await updateAthleteRatingSettings({
      ...defaultSettingsInput,
      publicEnabled: false,
    })

    const publicResult = await getPublicAthleteRatings('overall')
    expect(publicResult).toBeNull()
  })

  it('returns public payload without published fields when enabled', async () => {
    await updateAthleteRatingSettings(defaultSettingsInput)

    const publicResult = await getPublicAthleteRatings('overall')
    expect(publicResult).not.toBeNull()
    expect(publicResult?.publicEnabled).toBe(true)
    expect(publicResult?.topLimit).toBe(10)
    expect(publicResult?.formula.placePoints.first).toBe(60)
    expect(publicResult?.formula.ageCoefficients.length).toBe(8)
    expect(publicResult).not.toHaveProperty('published')
    expect(publicResult).not.toHaveProperty('publishedAt')
    if (publicResult && publicResult.rows.length > 0) {
      expect(publicResult.rows[0]).toHaveProperty('ratingHundredths')
      expect(publicResult.rows[0]).not.toHaveProperty('points')
    }
  })
})

describe('athlete ratings integration with published bracket', () => {
  useIntegrationDb()

  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  beforeEach(async () => {
    if (!dbAvailable) return
    await resetAthleteRatingSettings()
    await ensureBracketDefaults()
    await ensureChampionFormatRule()
  })

  afterEach(async () => {
    if (!dbAvailable) return
    await resetAthleteRatingSettings()
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
  })

  it('computes the same athlete rating for admin and public from published champion category', async () => {
    const solo = await seedPaidEntry('rating-flow')
    registrationIds.push(solo.registrationId)
    entryIds.push(solo.entryId)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const published = await publishActiveForIntegration({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
    })
    generationIds.push(published.publishedGenerationId)

    await updateAthleteRatingSettings(defaultSettingsInput)

    const entry = await prisma.athleteEntry.findUnique({
      where: { id: solo.entryId },
      select: { athleteId: true },
    })
    expect(entry).not.toBeNull()

    const admin = await getAdminAthleteRatings('overall')
    const publicResult = await getPublicAthleteRatings('overall')

    expect(admin.rows.length).toBeGreaterThan(0)
    const adminRow = admin.rows.find((row) => row.athleteId === entry!.athleteId)
    expect(adminRow).toBeDefined()
    expect(adminRow?.ratingHundredths).toBeGreaterThan(0)
    expect(adminRow?.placementSummary).toContain('1')

    expect(publicResult).not.toBeNull()
    const publicRow = publicResult?.rows.find((row) => row.athleteId === entry!.athleteId)
    expect(publicRow).toBeDefined()
    expect(publicRow?.ratingHundredths).toBe(adminRow?.ratingHundredths)
    expect(publicRow?.rank).toBe(adminRow?.rank)
  })

  it('keeps athlete rating available when category is hidden from public brackets', async () => {
    const solo = await seedPaidEntry('hidden-rating')
    registrationIds.push(solo.registrationId)
    entryIds.push(solo.entryId)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const published = await publishActiveForIntegration({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
    })
    generationIds.push(published.publishedGenerationId)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: published.publishedGenerationId, status: 'ACTIVE' },
    })
    expect(draw).not.toBeNull()

    await prisma.bracketPublicationState.update({
      where: { categoryKey: draw!.categoryKey },
      data: { visible: false },
    })

    await updateAthleteRatingSettings(defaultSettingsInput)

    const admin = await getAdminAthleteRatings('overall')
    const publicResult = await getPublicAthleteRatings('overall')

    const entry = await prisma.athleteEntry.findUnique({
      where: { id: solo.entryId },
      select: { athleteId: true },
    })
    expect(entry).not.toBeNull()

    expect(admin.rows.some((row) => row.athleteId === entry!.athleteId)).toBe(true)
    expect(publicResult?.rows.some((row) => row.athleteId === entry!.athleteId)).toBe(true)
  })
})
