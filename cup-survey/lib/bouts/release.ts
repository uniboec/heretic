import { Prisma, type BracketGeneration } from '@prisma/client'
import { prisma } from '../prisma'
import { computeDraftDiff } from '../brackets/core/diff'
import { BracketOperationError } from '../brackets/core/errors'
import { acquireBracketWriteLocks } from '../brackets/live/locks'
import { loadEligibleEntries } from '../brackets/core/eligibility'
import {
  getActivePublishedGeneration,
  getCurrentPublishedDraws,
  type PublishedDrawPair,
} from '../brackets/generation/publishedDraws'
import { ensureLivePublicationPointers } from '../brackets/generation/publicationState'
import { resolveWorkingDraftGeneration } from '../brackets/live/generation'
import { extractPlayableBoutsForPair } from './extractForPair'
import {
  categoryEligibleForAwardsSchedule,
  categoryRequiresBouts,
} from '../brackets/core/categoryRequiresBouts'
import {
  releasePublishedPairToAwardsSchedule,
  unreleasePublishedPairFromAwardsSchedule,
} from '../awards/releaseFromSchedule'
import { getEffectiveAutoMatAssignMode } from './autoMatAssign'
import { BoutsConfigurationError } from './errors'
import { cleanupEmptyExecutionsIfNotStarted } from './executionGuards'
import { loadScheduleSnapshot } from './scheduleService'
import { parseBoutMatAssignments } from './legacyReleaseGate'
import { toPlayableBouts } from './toPlayableBouts'
import { assignMatForCategoryBatch } from './matCountChange'
import { createMatLoads, toMatTimingSettings } from './matLoad'
import { accumulateReleasedLoad } from './releasedLoad'
import { bumpScheduleVersionIfNeeded } from './scheduleStructuralMutation'
import {
  assertCategoryBoutIdsStable,
  loadExecutionsForBoutIds,
} from './boutIdStability'

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  timeout: 30_000,
} as const

export type BoutsReleaseRequest =
  | {
      scope: 'category'
      categoryKey: string
      released: boolean
      expectedPublishedDrawId: string
      expectedPublishedGenerationId: string
      expectedScheduleVersion?: number
    }
  | {
      scope: 'ready'
      released: true
      expectedPublishedGenerationId: string
      expectedScheduleVersion?: number
    }
  | {
      scope: 'all'
      released: false
      expectedPublishedGenerationId: string
      expectedScheduleVersion?: number
    }

function assertMatInRange(mat: number | null | undefined, matCount: number, context: string) {
  if (mat == null || mat < 1 || mat > matCount) {
    throw new BoutsConfigurationError(
      `Некорректная конфигурация площадок (${context}): mat=${mat}, matCount=${matCount}`,
    )
  }
}

type ReadyScheduleKeys = {
  boutKeys: Set<string>
  awardKeys: Set<string>
}

async function loadReadyCategoryKeys(
  tx: Prisma.TransactionClient,
  currentPairs: PublishedDrawPair[],
): Promise<ReadyScheduleKeys> {
  const empty: ReadyScheduleKeys = { boutKeys: new Set(), awardKeys: new Set() }
  const live = await resolveWorkingDraftGeneration(tx)
  if (!live) return empty

  const draft = await tx.bracketGeneration.findUnique({
    where: { id: live.id },
    include: {
      categories: { include: { participants: { orderBy: { seedPosition: 'asc' } } } },
    },
  })
  if (!draft) return empty

  const bracketSettings =
    (await tx.bracketPageSetting.findUnique({ where: { id: 'default' } })) ?? {
      includePaid: true,
      includeUnpaid: false,
    }
  const regState = await tx.tournamentRegistrationState.findUnique({ where: { id: 'default' } })
  const eligible = await loadEligibleEntries({
    includePaid: bracketSettings.includePaid,
    includeUnpaid: bracketSettings.includeUnpaid,
  })
  const eligibleMap = new Map(eligible.map((entry) => [entry.entryId, entry]))
  const placements = await tx.bracketEntryPlacement.findMany()
  const placementMap = new Map(
    placements.map((placement) => [
      placement.entryId,
      { categoryKey: placement.categoryKey, isManualMove: placement.isManualMove },
    ]),
  )

  const diff = computeDraftDiff(
    eligible,
    draft.sourceRevision,
    draft.sourceFingerprint,
    regState?.revision ?? BigInt(0),
    draft.categories.map((category) => ({
      categoryKey: category.categoryKey,
      sourceFingerprint: category.sourceFingerprint,
      seedingFingerprint: category.seedingFingerprint,
      drawInputFingerprint: category.drawInputFingerprint,
      drawPolicyId: category.drawPolicyId,
      drawPolicyVersion: category.drawPolicyVersion,
      autoSystemId: category.autoSystemId,
      systemOverride: category.systemOverride,
      systemVersion: category.systemVersion,
      participants: category.participants.map((participant) => {
        const entry = eligibleMap.get(participant.entryId)
        return {
          entryId: participant.entryId,
          displayName: entry?.displayName ?? participant.snapshotDisplayName ?? '',
          seedPosition: participant.seedPosition,
          clubIdentity: entry?.clubIdentity ?? '',
          strengthTier: entry?.strengthTier ?? null,
          clubKey: entry?.clubKey ?? null,
          cityKey: entry?.cityKey ?? null,
          seedLocked: participant.seedLocked,
        }
      }),
    })),
    placementMap,
  )

  const boutKeys = new Set<string>()
  const awardKeys = new Set<string>()
  for (const pair of currentPairs) {
    if (pair.draw.status !== 'ACTIVE') continue
    const catDiff = diff.categories[pair.draw.categoryKey]
    if (
      catDiff?.compositionStale ||
      catDiff?.seedingStale ||
      catDiff?.balanceStale ||
      diff.globalCompositionStale
    ) {
      continue
    }
    const categoryInput = {
      status: pair.draw.status,
      autoSystemId: pair.draw.autoSystemId,
      systemOverride: pair.draw.systemOverride,
      participantCount: pair.draw.participants.length,
    }
    if (categoryEligibleForAwardsSchedule(categoryInput)) {
      awardKeys.add(pair.draw.categoryKey)
      continue
    }
    if (!categoryRequiresBouts(categoryInput)) {
      continue
    }
    boutKeys.add(pair.draw.categoryKey)
  }
  return { boutKeys, awardKeys }
}

async function releaseCategoriesInBatch(
  tx: Prisma.TransactionClient,
  batch: PublishedDrawPair[],
  matCount: number,
  loads: number[],
  effectiveMode: ReturnType<typeof getEffectiveAutoMatAssignMode>,
  timingSettings: ReturnType<typeof toMatTimingSettings>,
) {
  await assignMatForCategoryBatch(tx, batch, matCount, loads, effectiveMode, timingSettings)
}

async function assertReleaseBatchBoutIdsStable(
  tx: Prisma.TransactionClient,
  batch: PublishedDrawPair[],
  executions: Awaited<ReturnType<typeof loadScheduleSnapshot>>['executions'],
) {
  for (const pair of batch) {
    const nextBoutIds = extractPlayableBoutsForPair(pair).map((bout) => bout.id)
    const categoryPrefix = `${pair.draw.categoryKey}::`
    const previousBoutIds = executions
      .filter((execution) => execution.boutId.startsWith(categoryPrefix))
      .map((execution) => execution.boutId)
    const categoryExecutions = await loadExecutionsForBoutIds(tx, previousBoutIds)
    assertCategoryBoutIdsStable({
      previousBoutIds,
      nextBoutIds,
      executions: categoryExecutions,
    })
  }
}

async function clearReleaseState(tx: Prisma.TransactionClient, categoryKeys: string[]) {
  for (const categoryKey of categoryKeys) {
    await tx.bracketPublicationState.update({
      where: { categoryKey },
      data: {
        boutsReleased: false,
        boutMatAssignments: Prisma.DbNull,
        matCountAtRelease: null,
      },
    })
  }
}

export async function setCategoriesBoutsReleased(input: BoutsReleaseRequest) {
  const result = await prisma.$transaction(async (tx) => {
    let scheduleVersion: number | undefined
    const lockCategoryKeys =
      input.scope === 'category' ? [input.categoryKey] : undefined
    const ctx = await acquireBracketWriteLocks(tx, {
      scope: 'minimal',
      categoryKeys: lockCategoryKeys,
    })

    const scheduleSnapshot = await loadScheduleSnapshot(tx)
    const expectedScheduleVersion =
      input.expectedScheduleVersion ?? scheduleSnapshot.settings.scheduleVersion
    await cleanupEmptyExecutionsIfNotStarted(tx, scheduleSnapshot.executions)

    const published = await getActivePublishedGeneration(tx)
    if (!published) {
      throw new BracketOperationError('NO_PUBLISHED_BRACKET', 'Сначала синхронизируйте состав категорий')
    }

    if (published.id !== input.expectedPublishedGenerationId) {
      throw new BracketOperationError(
        'VERSION_CONFLICT',
        'Состав сеток изменился. Обновите страницу.',
      )
    }

    if (published.id !== ctx.generation.id) {
      await tx.$queryRaw`
        SELECT * FROM "BracketGeneration" WHERE id = ${published.id} FOR UPDATE
      `
    }

    await ensureLivePublicationPointers(tx, published.id)

    const settings = ctx.boutsSettings
    const matCount = settings.matCount

    if (input.released && matCount < 1) {
      throw new BracketOperationError(
        'INVALID_MAT_COUNT',
        'Сначала укажите количество площадок',
      )
    }

    const currentPairs = await getCurrentPublishedDraws({ db: tx, activeGeneration: published })

    if (!input.released) {
      if (input.scope === 'category') {
        const pair = currentPairs.find((item) => item.draw.categoryKey === input.categoryKey)
        if (!pair) {
          throw new BracketOperationError('INVALID_BODY', 'Категория не найдена')
        }
        if (
          input.expectedPublishedDrawId &&
          pair.publicationState.publishedDrawId !== input.expectedPublishedDrawId
        ) {
          throw new BracketOperationError(
            'VERSION_CONFLICT',
            'Состав категории изменился. Обновите страницу.',
          )
        }
        if (!pair.publicationState.boutsReleased) {
          return { ok: true as const, noop: true, affectedCategoryKeys: [input.categoryKey] }
        }
        if (
          categoryEligibleForAwardsSchedule({
            status: pair.draw.status,
            autoSystemId: pair.draw.autoSystemId,
            systemOverride: pair.draw.systemOverride,
            participantCount: pair.draw.participants.length,
          })
        ) {
          await unreleasePublishedPairFromAwardsSchedule(tx, input.categoryKey)
        } else {
          await clearReleaseState(tx, [input.categoryKey])
        }
        scheduleVersion = await bumpScheduleVersionIfNeeded(tx, expectedScheduleVersion, true)
        return {
          ok: true as const,
          affectedCategoryKeys: [input.categoryKey],
          scheduleVersion,
        }
      }

      const releasedPairs = currentPairs.filter((pair) => pair.publicationState.boutsReleased)
      if (releasedPairs.length === 0) {
        return { ok: true as const, noop: true, affectedCategoryKeys: [] }
      }
      const boutKeys: string[] = []
      for (const pair of releasedPairs) {
        if (
          categoryEligibleForAwardsSchedule({
            status: pair.draw.status,
            autoSystemId: pair.draw.autoSystemId,
            systemOverride: pair.draw.systemOverride,
            participantCount: pair.draw.participants.length,
          })
        ) {
          await unreleasePublishedPairFromAwardsSchedule(tx, pair.draw.categoryKey)
        } else {
          boutKeys.push(pair.draw.categoryKey)
        }
      }
      if (boutKeys.length > 0) {
        await clearReleaseState(tx, boutKeys)
      }
      scheduleVersion = await bumpScheduleVersionIfNeeded(tx, expectedScheduleVersion, true)
      return { ok: true as const, affectedCategoryKeys: releasedKeys, scheduleVersion }
    }

    let boutBatch: PublishedDrawPair[] = []
    let awardBatch: PublishedDrawPair[] = []

    if (input.scope === 'category') {
      const pair = currentPairs.find((item) => item.draw.categoryKey === input.categoryKey)
      if (!pair) {
        throw new BracketOperationError('INVALID_BODY', 'Категория не найдена')
      }
      if (
        input.expectedPublishedDrawId &&
        pair.publicationState.publishedDrawId !== input.expectedPublishedDrawId
      ) {
        throw new BracketOperationError(
          'VERSION_CONFLICT',
          'Состав категории изменился. Обновите страницу.',
        )
      }
      if (pair.publicationState.boutsReleased) {
        return { ok: true as const, noop: true, affectedCategoryKeys: [input.categoryKey] }
      }
      if (pair.draw.status !== 'ACTIVE') {
        throw new BracketOperationError(
          'UNSUPPORTED_CATEGORY',
          'Категория не готова к выпуску в расписание',
        )
      }
      const readyKeys = await loadReadyCategoryKeys(tx, currentPairs)
      if (readyKeys.awardKeys.has(pair.draw.categoryKey)) {
        awardBatch = [pair]
      } else if (readyKeys.boutKeys.has(pair.draw.categoryKey)) {
        boutBatch = [pair]
      } else {
        throw new BracketOperationError(
          'UNSUPPORTED_CATEGORY',
          'Категория не готова к выпуску в расписание',
        )
      }
    } else {
      const readyKeys = await loadReadyCategoryKeys(tx, currentPairs)
      const pending = currentPairs
        .filter(
          (pair) =>
            pair.draw.status === 'ACTIVE' && !pair.publicationState.boutsReleased,
        )
        .sort((a, b) => a.draw.categoryKey.localeCompare(b.draw.categoryKey, 'ru'))
      awardBatch = pending.filter((pair) => readyKeys.awardKeys.has(pair.draw.categoryKey))
      boutBatch = pending.filter((pair) => readyKeys.boutKeys.has(pair.draw.categoryKey))
    }

    if (boutBatch.length === 0 && awardBatch.length === 0) {
      return { ok: true as const, noop: true, affectedCategoryKeys: [] }
    }

    if (boutBatch.length > 0) {
      await assertReleaseBatchBoutIdsStable(tx, boutBatch, scheduleSnapshot.executions)

      const effectiveMode = getEffectiveAutoMatAssignMode(settings)
      const timingSettings = toMatTimingSettings(settings)
      const loads = createMatLoads(matCount)
      const releasedPairs = await getCurrentPublishedDraws({
        db: tx,
        activeGeneration: published,
        require: 'boutsReleased',
      })
      const excludeCategoryKeys = new Set(boutBatch.map((pair) => pair.draw.categoryKey))
      accumulateReleasedLoad(
        releasedPairs,
        matCount,
        loads,
        effectiveMode,
        timingSettings,
        excludeCategoryKeys,
      )

      await releaseCategoriesInBatch(
        tx,
        boutBatch,
        matCount,
        loads,
        effectiveMode,
        timingSettings,
      )
    }

    for (const pair of awardBatch) {
      await releasePublishedPairToAwardsSchedule(tx, pair)
    }

    scheduleVersion = await bumpScheduleVersionIfNeeded(tx, expectedScheduleVersion, true)
    return {
      ok: true as const,
      affectedCategoryKeys: [...boutBatch, ...awardBatch].map((pair) => pair.draw.categoryKey),
      scheduleVersion,
    }
  }, TX_OPTIONS)

  if (result.ok && !('noop' in result && result.noop)) {
    const { scheduleMatAnnouncerSync } = await import('../announcer/hooks/scheduleMatSync')
    scheduleMatAnnouncerSync()
  }

  return result
}

/** @deprecated matCount path uses reassign + demotion in matCountChange.ts */
export async function autoUnreleaseOnMatCountChange(
  tx: Prisma.TransactionClient,
  newMatCount: number,
  activeGeneration: BracketGeneration | null,
) {
  if (!activeGeneration) return 0
  const pairs = await getCurrentPublishedDraws({ db: tx, activeGeneration })
  const toClear = pairs.filter((pair) => {
    if (!pair.publicationState.boutsReleased) return false
    if (pair.publicationState.matCountAtRelease !== newMatCount) return true
    const assignments = parseBoutMatAssignments(pair.publicationState.boutMatAssignments)
    if (assignments) {
      return Object.values(assignments).some((mat) => mat > newMatCount)
    }
    const stored = pair.draw.matIndex
    return stored != null && stored > newMatCount
  })
  if (toClear.length === 0) return 0
  await clearReleaseState(
    tx,
    toClear.map((pair) => pair.draw.categoryKey),
  )
  return toClear.length
}

/** Auto-unrelease released Auto categories when autoMatAssignMode changes. */
export async function autoUnreleaseReleasedAutoCategories(
  tx: Prisma.TransactionClient,
  activeGeneration: BracketGeneration | null,
) {
  if (!activeGeneration) return 0
  const pairs = await getCurrentPublishedDraws({ db: tx, activeGeneration })
  const toClear = pairs.filter(
    (pair) => pair.publicationState.boutsReleased && pair.draw.matIndex == null,
  )
  if (toClear.length === 0) return 0
  await clearReleaseState(
    tx,
    toClear.map((pair) => pair.draw.categoryKey),
  )
  return toClear.length
}
