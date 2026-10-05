import { randomUUID } from 'crypto'
import { prisma } from '../../../prisma'
import { assertIntegrationTestDatabase } from '../../../db/integrationDatabaseUrl'
import { getRegistrationCategoryKey } from '../../../registration/categoryIdentity'
import { updateBracketDrawMatIndex } from '../../../bouts/mutations'
import { VersionConflictError } from '../../core/errors'
import { computeSourceCompositionFingerprint } from '../../core/fingerprint'
import { loadEligibleEntries } from '../../core/eligibility'
import { validateSeedPositions } from '../../core/seeding/validateSeeds'
import { deserializePublishedStructure } from '../../core/snapshot'
import { redrawBracketDraft } from '../../generation/redraw'
import { syncBracketDraft } from '../../generation/sync'
import { DEFAULT_FORMAT_RULES } from '../../defaultFormatRules'
import { TOURNAMENT_SCOPE_ID } from '../../../config/tournament'
import { publishBracketDraft } from '../../generation/publish'
import { applyBoutResultToCompetitionStructure } from '../../applyBoutResultToCompetitionStructure'

export const CAT_A = 'tactic_control:beginner:m_juniors_1:w_66'
export const CAT_B = 'tactic_control:beginner:m_juniors_1:w_71'
export const CAT_C = 'tactic_control:beginner:m_juniors_1:w_77'

/** Fast sizes for matrix tests (balanced draw stays under ~30s each). */
export const STRESS_CATEGORY_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 12] as const

/** Large olympic sizes — slow balanced-draw search; run in dedicated tests only. */
export const STRESS_LARGE_CATEGORY_SIZES = [16, 20, 24, 32] as const

const STRESS_CLUBS = [
  { name: 'Stress Club Alpha', city: 'City A' },
  { name: 'Stress Club Beta', city: 'City B' },
  { name: 'Stress Club Gamma', city: 'City C' },
  { name: 'Stress Club Delta', city: 'City D' },
  { name: 'Stress Club Epsilon', city: 'City E' },
  { name: 'Stress Club Zeta', city: 'City F' },
  { name: 'Stress Club Eta', city: 'City G' },
  { name: 'Stress Club Theta', city: 'City H' },
] as const

export function stressWeightCategoryId(participantCount: number): string {
  return `stress_w_${String(participantCount).padStart(2, '0')}`
}

export function expectedAutoSystemForCount(count: number): string {
  if (count === 1) return 'champion'
  if (count === 2) return 'olympic'
  if (count === 3) return 'three_way'
  return 'olympic'
}

export async function seedCategoryWithAthletes(input: {
  participantCount: number
  weightCategoryId?: string
  discipline?: 'tactic_control' | 'close_control'
  experienceLevel?: string
  ageDivisionId?: string
  gender?: 'male' | 'female'
  clubCount?: number
}): Promise<{
  categoryKey: string
  registrationIds: string[]
  entryIds: string[]
  participantCount: number
}> {
  const {
    participantCount,
    weightCategoryId = stressWeightCategoryId(participantCount),
    discipline = 'tactic_control',
    experienceLevel = 'beginner',
    ageDivisionId = 'm_juniors_1',
    gender = 'male',
    clubCount = participantCount >= 16
      ? 3
      : Math.min(8, Math.max(2, Math.ceil(participantCount / 4))),
  } = input

  const categoryKey = getRegistrationCategoryKey({
    discipline,
    experienceLevel,
    ageDivisionId,
    weightCategoryId,
  })

  const registrationIds: string[] = []
  const entryIds: string[] = []

  for (let index = 0; index < participantCount; index++) {
    const club = STRESS_CLUBS[index % clubCount]
    const registration = await prisma.teamRegistration.create({
      data: {
        clubName: club.name,
        city: club.city,
        phone: `+7910${String(Date.now()).slice(-5)}${String(index).padStart(3, '0')}`,
        registrationStage: 'main',
        pricePerDiscipline: 1000,
        totalAmount: 1000,
        consentPersonalData: true,
        consentPublication: true,
        status: 'PAID',
        athletes: {
          create: {
            lastName: `Stress${participantCount}`,
            firstName: `Athlete${index + 1}`,
            birthDate: new Date(`2012-${String((index % 12) + 1).padStart(2, '0')}-15`),
            gender,
            entries: {
              create: {
                discipline,
                experienceLevel,
                ageDivisionId,
                weightCategoryId,
                price: 1000,
                paymentStatus: 'PAID',
                paidAt: new Date(),
              },
            },
          },
        },
      },
      include: { athletes: { include: { entries: true } } },
    })
    registrationIds.push(registration.id)
    entryIds.push(registration.athletes[0]!.entries[0]!.id)
  }

  return { categoryKey, registrationIds, entryIds, participantCount }
}

export async function seedStressMatrixCategorySizes(
  sizes: readonly number[] = STRESS_CATEGORY_SIZES,
) {
  const categories: Array<{
    categoryKey: string
    participantCount: number
    registrationIds: string[]
    entryIds: string[]
  }> = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  for (const size of sizes) {
    const seeded = await seedCategoryWithAthletes({ participantCount: size })
    categories.push({
      categoryKey: seeded.categoryKey,
      participantCount: seeded.participantCount,
      registrationIds: seeded.registrationIds,
      entryIds: seeded.entryIds,
    })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)
  }

  return { categories, registrationIds, entryIds }
}

export async function collectDrawConsistencyIssues(generationId: string): Promise<string[]> {
  const issues: string[] = []
  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId, status: 'ACTIVE' },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
  })

  for (const draw of draws) {
    const seedIssue = validateSeedPositions(
      draw.participants.map((participant) => participant.seedPosition),
      draw.participants.length,
    )
    if (seedIssue) {
      issues.push(`${draw.categoryKey}: ${seedIssue.message}`)
    }
    const effectiveSystem = draw.systemOverride ?? draw.autoSystemId
    if (!draw.seedingFingerprint && effectiveSystem !== 'champion') {
      issues.push(`${draw.categoryKey}: missing seedingFingerprint`)
    }
    if (!draw.publishedStructureJson) {
      issues.push(`${draw.categoryKey}: missing publishedStructureJson`)
      continue
    }

    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    if (!snapshot?.systemId) {
      issues.push(`${draw.categoryKey}: missing systemId in snapshot`)
    }

    for (const participant of draw.participants) {
      const placement = await prisma.bracketEntryPlacement.findUnique({
        where: { entryId: participant.entryId },
      })
      if (placement && placement.categoryKey !== draw.categoryKey) {
        issues.push(
          `${draw.categoryKey}: placement mismatch for ${participant.entryId} -> ${placement.categoryKey}`,
        )
      }
    }
  }

  return issues
}

export const DEFAULT_BOUTS_PAGE_SETTING = {
  autoMatAssignMode: 'BY_CATEGORY' as const,
  autoMatByCategoryEnabled: true,
}

/** Defaults for new tournaments (production/demo seed). */
export const NEW_TOURNAMENT_BOUTS_PAGE_SETTING = {
  ...DEFAULT_BOUTS_PAGE_SETTING,
  athleteParticipationSpacing: {
    enabled: true,
    mode: 'BOUT_COUNT' as const,
    regular: 2,
    medal: 5,
  },
}

export const LEGACY_BOUTS_PAGE_SETTING = {
  autoMatAssignMode: 'BY_BOUT' as const,
  autoMatByCategoryEnabled: false,
}

export async function seedBoutsPageSetting(
  overrides: Partial<{
    publicEnabled: boolean
    matCount: number
    autoMatAssignMode: 'BY_CATEGORY' | 'BY_BOUT' | 'BY_CATEGORY_TIME' | 'BY_BOUT_TIME'
    autoMatByCategoryEnabled: boolean
    athleteParticipationSpacing: typeof NEW_TOURNAMENT_BOUTS_PAGE_SETTING.athleteParticipationSpacing | null
  }> = {},
) {
  const base = {
    publicEnabled: false,
    matCount: 3,
    ageDivisionDurationOverrides: {},
    athleteParticipationSpacing: null,
    ...DEFAULT_BOUTS_PAGE_SETTING,
    ...overrides,
  }
  return prisma.boutsPageSetting.upsert({
    where: { id: 'default' },
    create: base,
    update: base,
  })
}

export async function holdBoutsPageSettingRowLock(until: () => boolean, pollMs = 25) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM "BoutsPageSetting" WHERE id = 'default' FOR UPDATE`
      while (!until()) {
        await new Promise((resolve) => setTimeout(resolve, pollMs))
      }
    },
    { timeout: 30_000 },
  )
}

export type PublishedAutoFixedDraft = {
  publishedGenerationId: string
  autoKey: string
  fixedKey: string
  autoDrawId: string
  fixedDrawId: string
  draft: { id: string; version: number }
  registrationIds: string[]
  entryIds: string[]
}

export async function publishAutoAndFixedCategoryDraft(
  fixedMatIndex: number | null = 2,
): Promise<PublishedAutoFixedDraft> {
  await ensureBracketDefaults()
  const threeWay = await seedThreePaidEntriesSameCategory()
  const pair = await seedTwoPaidEntriesDifferentClubs()
  const registrationIds = [threeWay.registrationId, ...pair.registrationIds]
  const entryIds = [...threeWay.entryIds, ...pair.entryIds]

  const draft = await createIsolatedDraft()
  const ready = await syncRedrawAll(draft.id, draft.version)

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: ready.draft.id, status: 'ACTIVE' },
  })
  const autoDraw = draws.find((draw) => draw.categoryKey.includes('w_71'))
  const fixedDraw = draws.find((draw) => draw.categoryKey.includes('w_66'))
  if (!autoDraw || !fixedDraw) {
    throw new Error('Expected auto and fixed category draws')
  }

  let workingDraft = ready.draft
  if (fixedMatIndex != null) {
    const matUpdate = await updateBracketDrawMatIndex({
      drawId: fixedDraw.id,
      draftId: workingDraft.id,
      expectedVersion: workingDraft.version,
      matIndex: fixedMatIndex,
    })
    workingDraft = matUpdate.draft
  }

  const published = await publishActiveForIntegration({
    draftId: workingDraft.id,
    expectedVersion: workingDraft.version,
  })

  const publishedDraws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: published.publishedGenerationId, status: 'ACTIVE' },
  })
  const publishedAuto = publishedDraws.find((draw) => draw.categoryKey === autoDraw.categoryKey)
  const publishedFixed = publishedDraws.find((draw) => draw.categoryKey === fixedDraw.categoryKey)
  if (!publishedAuto || !publishedFixed) {
    throw new Error('Expected published auto and fixed draws')
  }

  return {
    publishedGenerationId: published.publishedGenerationId,
    autoKey: publishedAuto.categoryKey,
    fixedKey: publishedFixed.categoryKey,
    autoDrawId: publishedAuto.id,
    fixedDrawId: publishedFixed.id,
    draft: published.draft,
    registrationIds,
    entryIds,
  }
}

export async function ensureBracketDefaults() {
  await prisma.tournamentRegistrationState.upsert({
    where: { id: 'default' },
    create: { revision: BigInt(0) },
    update: {},
  })
  if (!(await prisma.boutsPageSetting.findUnique({ where: { id: 'default' } }))) {
    await seedBoutsPageSetting()
  }
  await prisma.bracketPageSetting.upsert({
    where: { id: 'default' },
    create: { publicEnabled: false, includePaid: true, includeUnpaid: false },
    update: { includePaid: true, includeUnpaid: false },
  })

  const ruleCount = await prisma.bracketFormatRule.count()
  if (ruleCount === 0) {
    await prisma.bracketFormatRule.createMany({ data: DEFAULT_FORMAT_RULES })
  }
}

export async function createIntegrationBoutResult(input: {
  boutId: string
  winnerEntryId: string
  loserEntryId: string
  resultVersion?: number
}) {
  return prisma.boutResult.create({
    data: {
      boutId: input.boutId,
      resultVersion: input.resultVersion ?? 1,
      isCurrent: true,
      tournamentScopeId: TOURNAMENT_SCOPE_ID,
      winnerEntryId: input.winnerEntryId,
      loserEntryId: input.loserEntryId,
      victoryMethod: 'POINTS',
      decisionReason: 'integration test',
      decidedInPeriod: 'main',
      mainRedScore: 4,
      mainBlueScore: 0,
      officialEndedAt: new Date(),
      resultConfirmedAt: new Date(),
      attemptNumber: 1,
      resultStatus: 'ACTIVE',
    },
  })
}

export async function publishSeededOlympicCategory(input: {
  seeded: {
    categoryKey: string
    entryIds: string[]
  }
  generationIds: string[]
}) {
  const draft = await createIsolatedDraft()
  input.generationIds.push(draft.id)
  const ready = await syncRedrawAll(draft.id, draft.version)
  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { generationId: ready.draft.id, status: 'ACTIVE', categoryKey: input.seeded.categoryKey },
  })
  if (!draw) throw new Error('draw missing')

  const matUpdate = await updateBracketDrawMatIndex({
    drawId: draw.id,
    draftId: ready.draft.id,
    expectedVersion: ready.draft.version,
    matIndex: 1,
  })

  const published = await publishBracketDraft({
    draftId: matUpdate.draft.id,
    expectedVersion: matUpdate.draft.version,
  })
  input.generationIds.push(published.publishedGenerationId)

  const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
    where: { generationId: published.publishedGenerationId, categoryKey: input.seeded.categoryKey },
  })
  if (!publishedDraw) throw new Error('published draw missing')

  return { published, publishedDraw }
}

export async function applyIntegrationBoutResult(input: {
  categoryKey: string
  localBoutId: string
  winnerEntryId: string
  loserEntryId: string
  schedulePhase?: 'elimination' | 'bronze' | 'final' | 'round_robin'
}) {
  const boutId = `${input.categoryKey}::${input.localBoutId}`
  const phase =
    input.schedulePhase ??
    (input.localBoutId === 'bronze-fight'
      ? 'bronze'
      : input.localBoutId.startsWith('rr-')
        ? 'round_robin'
        : 'elimination')

  await createIntegrationBoutResult({
    boutId,
    winnerEntryId: input.winnerEntryId,
    loserEntryId: input.loserEntryId,
  })

  await prisma.$transaction((tx) =>
    applyBoutResultToCompetitionStructure(tx, {
      boutId,
      categoryKey: input.categoryKey,
      winnerEntryId: input.winnerEntryId,
      loserEntryId: input.loserEntryId,
      schedulePhase: phase,
    }),
  )
}

export async function purgeMatControlTables() {
  assertIntegrationTestDatabase()

  await prisma.scheduleMutationLog.deleteMany()
  await prisma.boutControlCommand.deleteMany()
  await prisma.boutEvent.deleteMany()
  await prisma.boutResultRevision.deleteMany()
  await prisma.boutResult.deleteMany()
  await prisma.resultCorrectionCase.deleteMany()
  await prisma.matControlSession.deleteMany()
  await prisma.athleteRestState.deleteMany()
  await prisma.boutScheduleExecution.deleteMany()
}

export async function purgeBracketIntegrationState() {
  assertIntegrationTestDatabase()

  await purgeMatControlTables()
  await prisma.bracketMoveAudit.deleteMany()
  await prisma.bracketEntryPlacement.deleteMany()
  await prisma.bracketAutoSyncEvent.deleteMany()
  await prisma.bracketPublicationState.deleteMany()
  await prisma.bracketDrawParticipant.deleteMany()
  await prisma.bracketCategoryDraw.deleteMany()
  await prisma.bracketGeneration.deleteMany()
  await prisma.teamRegistration.deleteMany()
  await prisma.bracketFormatRule.deleteMany()
  await ensureBracketDefaults()
  await resetRegistrationRevision()
}

export async function resetRegistrationRevision() {
  await prisma.tournamentRegistrationState.update({
    where: { id: 'default' },
    data: { revision: BigInt(0) },
  })
}

async function clearDraftDraws(draftId: string) {
  const drawIds = (
    await prisma.bracketCategoryDraw.findMany({
      where: { generationId: draftId },
      select: { id: true },
    })
  ).map((draw) => draw.id)
  if (drawIds.length > 0) {
    await prisma.bracketPublicationState.deleteMany({
      where: { publishedDrawId: { in: drawIds } },
    })
  }
  await prisma.bracketDrawParticipant.deleteMany({
    where: { draw: { generationId: draftId } },
  })
  await prisma.bracketCategoryDraw.deleteMany({ where: { generationId: draftId } })
}

export async function createIsolatedDraft(sourceRevision: bigint | null = BigInt(0)) {
  const eligible = await loadEligibleEntries({ includePaid: true, includeUnpaid: false })
  const sourceFingerprint = computeSourceCompositionFingerprint(eligible)

  await prisma.bracketPublicationState.deleteMany()
  await prisma.bracketDrawParticipant.deleteMany()
  await prisma.bracketCategoryDraw.deleteMany()
  await prisma.bracketGeneration.deleteMany()

  return prisma.bracketGeneration.create({
    data: {
      status: 'ACTIVE',
      singletonKey: 'live',
      baseSeed: randomUUID(),
      version: 1,
      sourceRevision,
      sourceFingerprint,
    },
  })
}

/** ACTIVE-only integration substitute for legacy publish (sets publication pointers in-place). */
export async function publishActiveForIntegration(input: {
  draftId: string
  expectedVersion: number
}) {
  const generation = await prisma.bracketGeneration.findUniqueOrThrow({
    where: { id: input.draftId },
  })
  if (generation.version !== input.expectedVersion) {
    throw new VersionConflictError()
  }

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: input.draftId, status: 'ACTIVE' },
  })
  for (const draw of draws) {
    await prisma.bracketPublicationState.upsert({
      where: { categoryKey: draw.categoryKey },
      create: {
        categoryKey: draw.categoryKey,
        publishedDrawId: draw.id,
        visible: false,
        boutsReleased: false,
      },
      update: { publishedDrawId: draw.id },
    })
  }

  const updated = await prisma.bracketGeneration.update({
    where: { id: input.draftId },
    data: { version: generation.version + 1, publishedAt: new Date() },
  })

  return {
    ok: true as const,
    publishedGenerationId: input.draftId,
    publishedAt: updated.publishedAt ?? new Date(),
    draft: { id: updated.id, version: updated.version },
  }
}

export async function seedPaidEntry(clubSuffix = '1') {
  const registration = await prisma.teamRegistration.create({
    data: {
      clubName: `Test Club ${clubSuffix}`,
      city: `City ${clubSuffix}`,
      phone: `+7900${String(Date.now()).slice(-7)}${clubSuffix.replace(/\D/g, '').slice(0, 3)}`,
      registrationStage: 'main',
      pricePerDiscipline: 1000,
      totalAmount: 1000,
      consentPersonalData: true,
      consentPublication: true,
      status: 'PAID',
      athletes: {
        create: {
          lastName: 'Иванов',
          firstName: `Тест${clubSuffix}`,
          birthDate: new Date('2012-01-01'),
          gender: 'male',
          entries: {
            create: {
              discipline: 'tactic_control',
              experienceLevel: 'beginner',
              ageDivisionId: 'm_juniors_1',
              weightCategoryId: 'w_66',
              price: 1000,
              paymentStatus: 'PAID',
            },
          },
        },
      },
    },
    include: { athletes: { include: { entries: true } } },
  })
  const entryId = registration.athletes[0].entries[0].id
  return { registrationId: registration.id, entryId }
}

export async function seedPaidPairInCategory(weightCategoryId: string, clubSuffix = '1') {
  const registration = await prisma.teamRegistration.create({
    data: {
      clubName: `Test Club ${clubSuffix}`,
      city: `City ${clubSuffix}`,
      phone: `+7901${String(Date.now()).slice(-7)}${clubSuffix.replace(/\D/g, '').slice(0, 2)}`,
      registrationStage: 'main',
      pricePerDiscipline: 2000,
      totalAmount: 2000,
      consentPersonalData: true,
      consentPublication: true,
      status: 'PAID',
      athletes: {
        create: [
          {
            lastName: 'Иванов',
            firstName: `А${clubSuffix}`,
            birthDate: new Date('2012-01-01'),
            gender: 'male',
            entries: {
              create: {
                discipline: 'tactic_control',
                experienceLevel: 'beginner',
                ageDivisionId: 'm_juniors_1',
                weightCategoryId,
                price: 1000,
                paymentStatus: 'PAID',
              },
            },
          },
          {
            lastName: 'Петров',
            firstName: `Б${clubSuffix}`,
            birthDate: new Date('2012-02-02'),
            gender: 'male',
            entries: {
              create: {
                discipline: 'tactic_control',
                experienceLevel: 'beginner',
                ageDivisionId: 'm_juniors_1',
                weightCategoryId,
                price: 1000,
                paymentStatus: 'PAID',
              },
            },
          },
        ],
      },
    },
    include: { athletes: { include: { entries: true } } },
  })
  const entryIds = registration.athletes.flatMap((athlete) => athlete.entries.map((entry) => entry.id))
  return { registrationId: registration.id, entryIds }
}

export async function prepareLargeDashboardDraft(categoryCount = 50) {
  await ensureBracketDefaults()
  const draft = await createIsolatedDraft()
  const registrationIds: string[] = []
  const entryIds: string[] = []

  for (let index = 0; index < categoryCount; index++) {
    const weightCategoryId = `w_${66 + index}`
    const seeded = await seedPaidPairInCategory(weightCategoryId, `bulk-${index}`)
    registrationIds.push(seeded.registrationId)
    entryIds.push(...seeded.entryIds)
  }

  const ready = await syncRedrawAll(draft.id, draft.version)
  return {
    draft: ready.draft,
    originalDraftId: draft.id,
    registrationIds,
    entryIds,
  }
}

export async function seedThreePaidEntriesSameCategory() {
  const registration = await prisma.teamRegistration.create({
    data: {
      clubName: 'Three Way Club',
      city: 'City Three',
      phone: `+7902${String(Date.now()).slice(-7)}`,
      registrationStage: 'main',
      pricePerDiscipline: 3000,
      totalAmount: 3000,
      consentPersonalData: true,
      consentPublication: true,
      status: 'PAID',
      athletes: {
        create: ['А', 'Б', 'В'].map((firstName, index) => ({
          lastName: 'Троев',
          firstName,
          birthDate: new Date(`2012-0${index + 1}-01`),
          gender: 'male',
          entries: {
            create: {
              discipline: 'tactic_control',
              experienceLevel: 'beginner',
              ageDivisionId: 'm_juniors_1',
              weightCategoryId: 'w_71',
              price: 1000,
              paymentStatus: 'PAID',
            },
          },
        })),
      },
    },
    include: { athletes: { include: { entries: true } } },
  })
  const entryIds = registration.athletes.flatMap((athlete) => athlete.entries.map((entry) => entry.id))
  return { registrationId: registration.id, entryIds }
}

export async function seedTwoPaidEntriesDifferentClubs() {
  const a = await seedPaidEntry(`a-${randomUUID().slice(0, 6)}`)
  const b = await seedPaidEntry(`b-${randomUUID().slice(0, 6)}`)
  return {
    registrationIds: [a.registrationId, b.registrationId],
    entryIds: [a.entryId, b.entryId],
  }
}

export async function seedTwoPaidEntriesSameRegistration() {
  const registration = await prisma.teamRegistration.create({
    data: {
      clubName: 'Dual Category Club',
      city: 'City Dual',
      phone: `+7903${String(Date.now()).slice(-7)}`,
      registrationStage: 'main',
      pricePerDiscipline: 3000,
      totalAmount: 6000,
      consentPersonalData: true,
      consentPublication: true,
      status: 'PAID',
      athletes: {
        create: [
          {
            lastName: 'Дважды',
            firstName: 'Альфа',
            birthDate: new Date('2012-01-01'),
            gender: 'male',
            entries: {
              create: {
                discipline: 'tactic_control',
                experienceLevel: 'beginner',
                ageDivisionId: 'm_juniors_1',
                weightCategoryId: 'w_66',
                price: 1000,
                paymentStatus: 'PAID',
              },
            },
          },
          {
            lastName: 'Дважды',
            firstName: 'Бета',
            birthDate: new Date('2012-02-01'),
            gender: 'male',
            entries: {
              create: {
                discipline: 'tactic_control',
                experienceLevel: 'beginner',
                ageDivisionId: 'm_juniors_1',
                weightCategoryId: 'w_71',
                price: 1000,
                paymentStatus: 'PAID',
              },
            },
          },
        ],
      },
    },
    include: { athletes: { include: { entries: true } } },
  })
  const entryIds = registration.athletes.flatMap((athlete) => athlete.entries.map((entry) => entry.id))
  return { registrationId: registration.id, entryIds }
}

export async function syncRedrawAll(draftId: string, expectedVersion: number) {
  const synced = await syncBracketDraft({
    draftId,
    expectedVersion,
    scope: 'all',
  })
  return redrawBracketDraft({
    draftId: synced.draft.id,
    expectedVersion: synced.draft.version,
    scope: 'all',
  })
}

export async function preparePublishableDraft() {
  await ensureBracketDefaults()
  const { registrationIds, entryIds } = await seedTwoPaidEntriesDifferentClubs()
  const draft = await createIsolatedDraft()
  const ready = await syncRedrawAll(draft.id, draft.version)
  return {
    draft: ready.draft,
    baseSeed: draft.baseSeed,
    originalDraftId: draft.id,
    registrationIds,
    entryIds,
  }
}

export async function cleanupBracketIntegrationData(ids: {
  generationIds?: string[]
  registrationIds?: string[]
  entryIds?: string[]
}) {
  if (ids.entryIds?.length) {
    await prisma.bracketMoveAudit.deleteMany({ where: { entryId: { in: ids.entryIds } } })
    await prisma.bracketEntryPlacement.deleteMany({ where: { entryId: { in: ids.entryIds } } })
  }
  if (ids.generationIds?.length) {
    for (const generationId of ids.generationIds) {
      await clearDraftDraws(generationId)
      await prisma.bracketGeneration.deleteMany({ where: { id: generationId } })
    }
  }
  if (ids.registrationIds?.length) {
    await prisma.teamRegistration.deleteMany({ where: { id: { in: ids.registrationIds } } })
  }
}
