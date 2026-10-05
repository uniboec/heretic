/**
 * Bracket ACTIVE singleton cutover (plan v7 steps 1–8).
 * Requires Migration A applied. Run in maintenance window.
 *
 * Usage:
 *   npx tsx scripts/migrate-brackets-single-live.ts --dry-run
 *   npx tsx scripts/migrate-brackets-single-live.ts --commit
 *   npx tsx scripts/migrate-brackets-single-live.ts --commit --use-checkpoint
 */
import { randomUUID } from 'crypto'
import { pathToFileURL } from 'node:url'
import {
  Prisma,
  type BracketCategoryDraw,
  type BracketDrawParticipant,
  type BracketGeneration,
  type BracketPublicationState,
} from '@prisma/client'
import { LIVE_GENERATION_SINGLETON_KEY } from '../lib/brackets/config'
import { getCategoryLockLevel } from '../lib/brackets/live/guard'
import { prisma } from '../lib/prisma'

const CHECKPOINT_ID = 'default'
const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }

type CutoverPhase =
  | 'step2'
  | 'step3'
  | 'step4'
  | 'step5'
  | 'step6'
  | 'step7'
  | 'step8'
  | 'complete'

export type GenerationSummary = {
  id: string
  status: BracketGeneration['status']
  singletonKey: string | null
  categoryCount: number
  generatedAt: Date
  publishedAt: Date | null
}

export type CutoverDryRunReport = {
  generations: {
    draft: GenerationSummary | null
    published: GenerationSummary | null
    active: GenerationSummary | null
    legacyCounts: { draft: number; published: number; active: number }
  }
  chosenLiveSource: 'PUBLISHED' | 'DRAFT' | null
  liveSourceId: string | null
  openDraftCategoriesToMerge: string[]
  publicationStates: {
    total: number
    stalePointers: string[]
    orphanStates: string[]
  }
  alreadyCutover: boolean
}

export type CutoverCommitResult = {
  liveSource: 'PUBLISHED' | 'DRAFT'
  activeGenerationId: string
  mergedOpenCategories: string[]
  reboundPublicationStates: number
  deletedLegacyGenerations: number
  mode: 'transaction' | 'checkpoint'
}

type CutoverPayload = {
  liveSource: 'PUBLISHED' | 'DRAFT'
  liveSourceId: string
  activeGenerationId: string
  mergedOpenCategories?: string[]
  reboundPublicationStates?: number
  deletedLegacyGenerations?: number
}

type DrawWithParticipants = BracketCategoryDraw & { participants: BracketDrawParticipant[] }

function parseCliFlags(argv: string[]) {
  const dryRun = argv.includes('--dry-run')
  const commit = argv.includes('--commit')
  const useCheckpoint = argv.includes('--use-checkpoint')

  if (dryRun === commit) {
    throw new Error('Specify exactly one of --dry-run or --commit')
  }
  if (useCheckpoint && !commit) {
    throw new Error('--use-checkpoint requires --commit')
  }

  return { dryRun, commit, useCheckpoint }
}

async function summarizeGeneration(
  generation: BracketGeneration & { _count?: { categories: number } },
): Promise<GenerationSummary> {
  const categoryCount =
    generation._count?.categories ??
    (await prisma.bracketCategoryDraw.count({ where: { generationId: generation.id } }))

  return {
    id: generation.id,
    status: generation.status,
    singletonKey: generation.singletonKey,
    categoryCount,
    generatedAt: generation.generatedAt,
    publishedAt: generation.publishedAt,
  }
}

export async function findLegacyGenerations(
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const [draft, published, active] = await Promise.all([
    client.bracketGeneration.findFirst({
      where: { status: 'DRAFT' as never },
      orderBy: { generatedAt: 'desc' },
      include: { _count: { select: { categories: true } } },
    }),
    client.bracketGeneration.findFirst({
      where: { status: 'PUBLISHED' as never },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      include: { _count: { select: { categories: true } } },
    }),
    client.bracketGeneration.findFirst({
      where: { singletonKey: LIVE_GENERATION_SINGLETON_KEY, status: 'ACTIVE' },
      include: { _count: { select: { categories: true } } },
    }),
  ])

  const [draftCount, publishedCount, activeCount] = await Promise.all([
    client.bracketGeneration.count({ where: { status: 'DRAFT' as never } }),
    client.bracketGeneration.count({ where: { status: 'PUBLISHED' as never } }),
    client.bracketGeneration.count({ where: { status: 'ACTIVE' } }),
  ])

  return {
    draft,
    published,
    active,
    legacyCounts: { draft: draftCount, published: publishedCount, active: activeCount },
  }
}

export function chooseLiveSource(input: {
  published: BracketGeneration | null
  draft: BracketGeneration | null
}): { source: 'PUBLISHED' | 'DRAFT'; generation: BracketGeneration } | null {
  if (input.published) {
    return { source: 'PUBLISHED', generation: input.published }
  }
  if (input.draft) {
    return { source: 'DRAFT', generation: input.draft }
  }
  return null
}

async function listOpenDraftCategoriesToMerge(
  client: Prisma.TransactionClient | typeof prisma,
  draftGenerationId: string,
  publicationStates: BracketPublicationState[],
): Promise<string[]> {
  const draftDraws = await client.bracketCategoryDraw.findMany({
    where: { generationId: draftGenerationId },
    select: { categoryKey: true },
  })
  const pubByKey = new Map(publicationStates.map((state) => [state.categoryKey, state]))
  return draftDraws
    .filter((draw) => getCategoryLockLevel(pubByKey.get(draw.categoryKey)) === 'OPEN')
    .map((draw) => draw.categoryKey)
    .sort()
}

async function analyzePublicationPointers(
  client: Prisma.TransactionClient | typeof prisma,
  activeGenerationId: string | null,
) {
  const publicationStates = await client.bracketPublicationState.findMany({
    include: { publishedDraw: true },
  })

  const stalePointers: string[] = []
  const orphanStates: string[] = []

  for (const state of publicationStates) {
    if (!state.publishedDraw) {
      orphanStates.push(state.categoryKey)
      continue
    }
    if (activeGenerationId && state.publishedDraw.generationId !== activeGenerationId) {
      stalePointers.push(state.categoryKey)
    }
  }

  return {
    total: publicationStates.length,
    stalePointers: stalePointers.sort(),
    orphanStates: orphanStates.sort(),
    publicationStates,
  }
}

export async function reportCutoverState(
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CutoverDryRunReport> {
  const legacy = await findLegacyGenerations(client)
  const chosen = chooseLiveSource(legacy)
  const publicationStates = await client.bracketPublicationState.findMany()

  const openDraftCategoriesToMerge =
    chosen?.source === 'PUBLISHED' && legacy.draft
      ? await listOpenDraftCategoriesToMerge(client, legacy.draft.id, publicationStates)
      : []

  const pointerAnalysis = await analyzePublicationPointers(
    client,
    legacy.active?.id ?? chosen?.generation.id ?? null,
  )

  const alreadyCutover =
    legacy.active !== null &&
    legacy.legacyCounts.draft === 0 &&
    legacy.legacyCounts.published === 0 &&
    legacy.legacyCounts.active === 1

  return {
    generations: {
      draft: legacy.draft ? await summarizeGeneration(legacy.draft) : null,
      published: legacy.published ? await summarizeGeneration(legacy.published) : null,
      active: legacy.active ? await summarizeGeneration(legacy.active) : null,
      legacyCounts: legacy.legacyCounts,
    },
    chosenLiveSource: chosen?.source ?? null,
    liveSourceId: chosen?.generation.id ?? legacy.active?.id ?? null,
    openDraftCategoriesToMerge,
    publicationStates: {
      total: pointerAnalysis.total,
      stalePointers: pointerAnalysis.stalePointers,
      orphanStates: pointerAnalysis.orphanStates,
    },
    alreadyCutover,
  }
}

function drawCreateInput(
  source: BracketCategoryDraw,
  targetGenerationId: string,
  participants: BracketDrawParticipant[],
): Prisma.BracketCategoryDrawCreateInput {
  return {
    id: randomUUID(),
    generation: { connect: { id: targetGenerationId } },
    categoryKey: source.categoryKey,
    discipline: source.discipline,
    title: source.title,
    status: source.status,
    statusReason: source.statusReason,
    autoSystemId: source.autoSystemId,
    systemOverride: source.systemOverride,
    autoBronzeMode: source.autoBronzeMode,
    bronzeModeOverride: source.bronzeModeOverride,
    systemVersion: source.systemVersion,
    drawSeed: source.drawSeed,
    redrawRevision: source.redrawRevision,
    sourceFingerprint: source.sourceFingerprint,
    seedingFingerprint: source.seedingFingerprint,
    drawPolicyId: source.drawPolicyId,
    drawPolicyVersion: source.drawPolicyVersion,
    drawInputFingerprint: source.drawInputFingerprint,
    publishedStructureJson:
      source.publishedStructureJson === null
        ? Prisma.JsonNull
        : (source.publishedStructureJson as Prisma.InputJsonValue),
    matIndex: source.matIndex,
    participants: {
      create: participants.map((participant) => ({
        id: randomUUID(),
        entryId: participant.entryId,
        seedPosition: participant.seedPosition,
        seedLocked: participant.seedLocked,
        snapshotDisplayName: participant.snapshotDisplayName,
        snapshotClubName: participant.snapshotClubName,
        snapshotCity: participant.snapshotCity,
        snapshotPublicNumber: participant.snapshotPublicNumber,
      })),
    },
  }
}

async function loadDraftDrawsWithParticipants(
  tx: Prisma.TransactionClient,
  draftGenerationId: string,
): Promise<DrawWithParticipants[]> {
  return tx.bracketCategoryDraw.findMany({
    where: { generationId: draftGenerationId },
    include: { participants: true },
    orderBy: { categoryKey: 'asc' },
  })
}

export async function mergeOpenDraftCategories(
  tx: Prisma.TransactionClient,
  input: {
    activeGenerationId: string
    draftGenerationId: string
    publicationStates: BracketPublicationState[]
  },
): Promise<string[]> {
  const pubByKey = new Map(input.publicationStates.map((state) => [state.categoryKey, state]))
  const draftDraws = await loadDraftDrawsWithParticipants(tx, input.draftGenerationId)
  const merged: string[] = []

  for (const draftDraw of draftDraws) {
    if (getCategoryLockLevel(pubByKey.get(draftDraw.categoryKey)) !== 'OPEN') {
      continue
    }

    const existing = await tx.bracketCategoryDraw.findUnique({
      where: {
        generationId_categoryKey: {
          generationId: input.activeGenerationId,
          categoryKey: draftDraw.categoryKey,
        },
      },
    })

    const created = await tx.bracketCategoryDraw.create({
      data: drawCreateInput(draftDraw, input.activeGenerationId, draftDraw.participants),
    })

    if (existing) {
      const pubState = pubByKey.get(draftDraw.categoryKey)
      if (pubState) {
        await tx.bracketPublicationState.update({
          where: { categoryKey: draftDraw.categoryKey },
          data: { publishedDrawId: created.id },
        })
      }
      await tx.bracketCategoryDraw.delete({ where: { id: existing.id } })
    }

    merged.push(draftDraw.categoryKey)
  }

  return merged.sort()
}

export async function rebindPublicationPointers(
  tx: Prisma.TransactionClient,
  activeGenerationId: string,
): Promise<number> {
  const [draws, publicationStates] = await Promise.all([
    tx.bracketCategoryDraw.findMany({
      where: { generationId: activeGenerationId },
      orderBy: { categoryKey: 'asc' },
    }),
    tx.bracketPublicationState.findMany(),
  ])

  const drawByKey = new Map(draws.map((draw) => [draw.categoryKey, draw]))
  let rebound = 0

  for (const state of publicationStates) {
    const draw = drawByKey.get(state.categoryKey)
    if (!draw) {
      throw new Error(
        `Publication state for "${state.categoryKey}" has no matching draw in ACTIVE generation`,
      )
    }
    if (state.publishedDrawId !== draw.id) {
      await tx.bracketPublicationState.update({
        where: { categoryKey: state.categoryKey },
        data: { publishedDrawId: draw.id },
      })
      rebound += 1
    }
  }

  return rebound
}

export async function verifyPublicationPointers(
  tx: Prisma.TransactionClient,
  activeGenerationId: string,
): Promise<void> {
  const analysis = await analyzePublicationPointers(tx, activeGenerationId)
  if (analysis.orphanStates.length > 0) {
    throw new Error(`Orphan publication states: ${analysis.orphanStates.join(', ')}`)
  }
  if (analysis.stalePointers.length > 0) {
    throw new Error(`Stale publication pointers: ${analysis.stalePointers.join(', ')}`)
  }
}

export async function assertActiveSingletonCount(tx: Prisma.TransactionClient): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "BracketGeneration"
    WHERE status = 'ACTIVE'::"BracketGenerationStatus"
      AND "singletonKey" = ${LIVE_GENERATION_SINGLETON_KEY}
  `
  const count = Number(rows[0]?.count ?? 0)
  if (count !== 1) {
    throw new Error(`Expected exactly one ACTIVE singleton, found ${count}`)
  }
}

export async function deleteLegacyGenerations(
  tx: Prisma.TransactionClient,
  activeGenerationId: string,
): Promise<number> {
  const result = await tx.bracketGeneration.deleteMany({
    where: {
      id: { not: activeGenerationId },
      OR: [
        { status: { in: ['DRAFT', 'PUBLISHED'] as never } },
        { status: 'ACTIVE', singletonKey: null as never },
        {
          status: 'ACTIVE',
          singletonKey: { not: LIVE_GENERATION_SINGLETON_KEY },
        },
      ],
    },
  })
  return result.count
}

async function readCheckpoint(client: Prisma.TransactionClient | typeof prisma) {
  return client.bracketCutoverCheckpoint.findUnique({ where: { id: CHECKPOINT_ID } })
}

async function writeCheckpoint(
  tx: Prisma.TransactionClient,
  phase: CutoverPhase,
  payload: CutoverPayload,
) {
  await tx.bracketCutoverCheckpoint.upsert({
    where: { id: CHECKPOINT_ID },
    create: {
      id: CHECKPOINT_ID,
      phase,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
    update: {
      phase,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  })
}

function phaseRank(phase: CutoverPhase): number {
  const order: CutoverPhase[] = [
    'step2',
    'step3',
    'step4',
    'step5',
    'step6',
    'step7',
    'step8',
    'complete',
  ]
  return order.indexOf(phase)
}

function shouldRunPhase(completedPhase: CutoverPhase | null | undefined, target: CutoverPhase) {
  if (!completedPhase) return true
  if (completedPhase === 'complete') return false
  return phaseRank(completedPhase) < phaseRank(target)
}

async function resolveCutoverContext(client: Prisma.TransactionClient | typeof prisma) {
  const legacy = await findLegacyGenerations(client)
  const existingCheckpoint = await readCheckpoint(client)
  const checkpointPayload = existingCheckpoint?.payload as CutoverPayload | null | undefined

  if (existingCheckpoint?.phase === 'complete' && legacy.active) {
    return {
      legacy,
      chosen: {
        source: checkpointPayload?.liveSource ?? ('PUBLISHED' as const),
        generation: legacy.active,
      },
      payload: checkpointPayload ?? {
        liveSource: 'PUBLISHED' as const,
        liveSourceId: legacy.active.id,
        activeGenerationId: legacy.active.id,
      },
      alreadyComplete: true,
    }
  }

  if (legacy.active?.singletonKey === LIVE_GENERATION_SINGLETON_KEY) {
    const payload =
      checkpointPayload ??
      ({
        liveSource: legacy.published ? 'PUBLISHED' : 'DRAFT',
        liveSourceId: legacy.active.id,
        activeGenerationId: legacy.active.id,
      } satisfies CutoverPayload)

    return {
      legacy,
      chosen: { source: payload.liveSource, generation: legacy.active },
      payload,
      alreadyComplete: legacy.legacyCounts.draft === 0 && legacy.legacyCounts.published === 0,
    }
  }

  const chosen = chooseLiveSource(legacy)
  if (!chosen) {
    throw new Error('No DRAFT or PUBLISHED generation available for cutover')
  }

  return {
    legacy,
    chosen,
    payload: checkpointPayload ?? {
      liveSource: chosen.source,
      liveSourceId: chosen.generation.id,
      activeGenerationId: chosen.generation.id,
    },
    alreadyComplete: false,
  }
}

async function runCutoverStepsInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    legacy: Awaited<ReturnType<typeof findLegacyGenerations>>
    chosen: { source: 'PUBLISHED' | 'DRAFT'; generation: BracketGeneration }
    publicationStates: BracketPublicationState[]
    skipPromote?: boolean
  },
): Promise<Omit<CutoverCommitResult, 'mode'>> {
  const activeGenerationId = input.chosen.generation.id

  if (!input.skipPromote) {
    await tx.bracketGeneration.update({
      where: { id: activeGenerationId },
      data: {
        status: 'ACTIVE',
        singletonKey: LIVE_GENERATION_SINGLETON_KEY,
      },
    })
  }

  let mergedOpenCategories: string[] = []
  if (input.chosen.source === 'PUBLISHED' && input.legacy.draft) {
    mergedOpenCategories = await mergeOpenDraftCategories(tx, {
      activeGenerationId,
      draftGenerationId: input.legacy.draft.id,
      publicationStates: input.publicationStates,
    })
  }

  const reboundPublicationStates = await rebindPublicationPointers(tx, activeGenerationId)
  await verifyPublicationPointers(tx, activeGenerationId)
  await assertActiveSingletonCount(tx)
  const deletedLegacyGenerations = await deleteLegacyGenerations(tx, activeGenerationId)

  return {
    liveSource: input.chosen.source,
    activeGenerationId,
    mergedOpenCategories,
    reboundPublicationStates,
    deletedLegacyGenerations,
  }
}

async function runCheckpointStep(
  step: CutoverPhase,
  payload: CutoverPayload,
  legacy: Awaited<ReturnType<typeof findLegacyGenerations>>,
  publicationStates: BracketPublicationState[],
): Promise<CutoverPayload> {
  return prisma.$transaction(async (tx) => {
    const nextPayload = { ...payload }

    if (step === 'step2') {
      nextPayload.liveSource = legacy.published ? 'PUBLISHED' : 'DRAFT'
      nextPayload.liveSourceId = (legacy.published ?? legacy.draft)!.id
      nextPayload.activeGenerationId = nextPayload.liveSourceId
      await writeCheckpoint(tx, 'step2', nextPayload)
      return nextPayload
    }

    if (step === 'step3') {
      const alreadyPromoted =
        legacy.active?.singletonKey === LIVE_GENERATION_SINGLETON_KEY &&
        legacy.active.id === nextPayload.activeGenerationId
      if (!alreadyPromoted) {
        await tx.bracketGeneration.update({
          where: { id: nextPayload.activeGenerationId },
          data: {
            status: 'ACTIVE',
            singletonKey: LIVE_GENERATION_SINGLETON_KEY,
          },
        })
      }
      await writeCheckpoint(tx, 'step3', nextPayload)
      return nextPayload
    }

    if (step === 'step4') {
      if (nextPayload.liveSource === 'PUBLISHED' && legacy.draft) {
        nextPayload.mergedOpenCategories = await mergeOpenDraftCategories(tx, {
          activeGenerationId: nextPayload.activeGenerationId,
          draftGenerationId: legacy.draft.id,
          publicationStates,
        })
      } else {
        nextPayload.mergedOpenCategories = []
      }
      await writeCheckpoint(tx, 'step4', nextPayload)
      return nextPayload
    }

    if (step === 'step5') {
      nextPayload.reboundPublicationStates = await rebindPublicationPointers(
        tx,
        nextPayload.activeGenerationId,
      )
      await writeCheckpoint(tx, 'step5', nextPayload)
      return nextPayload
    }

    if (step === 'step6') {
      await verifyPublicationPointers(tx, nextPayload.activeGenerationId)
      await writeCheckpoint(tx, 'step6', nextPayload)
      return nextPayload
    }

    if (step === 'step7') {
      await assertActiveSingletonCount(tx)
      await writeCheckpoint(tx, 'step7', nextPayload)
      return nextPayload
    }

    if (step === 'step8') {
      nextPayload.deletedLegacyGenerations = await deleteLegacyGenerations(
        tx,
        nextPayload.activeGenerationId,
      )
      await writeCheckpoint(tx, 'complete', nextPayload)
      return nextPayload
    }

    throw new Error(`Unsupported checkpoint step: ${step}`)
  })
}

export async function executeCutoverCommit(options: {
  useCheckpoint?: boolean
  client?: typeof prisma
}): Promise<CutoverCommitResult> {
  const client = options.client ?? prisma
  const context = await resolveCutoverContext(client)

  if (context.alreadyComplete) {
    return {
      liveSource: context.payload.liveSource,
      activeGenerationId: context.payload.activeGenerationId,
      mergedOpenCategories: context.payload.mergedOpenCategories ?? [],
      reboundPublicationStates: context.payload.reboundPublicationStates ?? 0,
      deletedLegacyGenerations: context.payload.deletedLegacyGenerations ?? 0,
      mode: options.useCheckpoint ? 'checkpoint' : 'transaction',
    }
  }

  const publicationStates = await client.bracketPublicationState.findMany()

  if (options.useCheckpoint) {
    const existing = await readCheckpoint(client)
    let payload =
      (existing?.payload as CutoverPayload | undefined) ??
      ({
        liveSource: context.chosen.source,
        liveSourceId: context.chosen.generation.id,
        activeGenerationId: context.chosen.generation.id,
      } satisfies CutoverPayload)

    const completedPhase =
      existing?.phase === 'complete' ? 'complete' : (existing?.phase as CutoverPhase | undefined)

    for (const step of [
      'step2',
      'step3',
      'step4',
      'step5',
      'step6',
      'step7',
      'step8',
    ] as CutoverPhase[]) {
      if (!shouldRunPhase(completedPhase, step)) continue
      payload = await runCheckpointStep(step, payload, context.legacy, publicationStates)
    }

    return {
      liveSource: payload.liveSource,
      activeGenerationId: payload.activeGenerationId,
      mergedOpenCategories: payload.mergedOpenCategories ?? [],
      reboundPublicationStates: payload.reboundPublicationStates ?? 0,
      deletedLegacyGenerations: payload.deletedLegacyGenerations ?? 0,
      mode: 'checkpoint',
    }
  }

  const result = await client.$transaction(async (tx) => {
    return runCutoverStepsInTransaction(tx, {
      legacy: context.legacy,
      chosen: context.chosen,
      publicationStates,
      skipPromote: context.legacy.active?.singletonKey === LIVE_GENERATION_SINGLETON_KEY,
    })
  }, SERIALIZABLE)

  return { ...result, mode: 'transaction' }
}

async function main() {
  const flags = parseCliFlags(process.argv.slice(2))

  if (flags.dryRun) {
    const report = await reportCutoverState()
    console.log(JSON.stringify(report, null, 2))
    return
  }

  const result = await executeCutoverCommit({ useCheckpoint: flags.useCheckpoint })
  console.log(JSON.stringify(result, null, 2))
}

const isDirectExecution =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectExecution) {
  main()
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
