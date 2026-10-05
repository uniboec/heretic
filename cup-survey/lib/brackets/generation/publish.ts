import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { loadEligibleEntries } from '../core/eligibility'
import { computeSourceCompositionFingerprint } from '../core/fingerprint'
import { computeDraftDiff } from '../core/diff'
import {
  PublishValidationError,
  isSerializationFailure,
} from '../core/errors'
import { lockBoutsPageSetting } from '../../bouts/locks'
import { lockDraftForMutation, lockRegistrationState } from '../core/locks'
import { formatSystemLabel } from '../labels'
import { BracketSystemRegistry } from '../core/registry'
import {
  getEffectiveBronzeMode,
  getEffectiveSystemId,
  resolveFormatRule,
} from '../core/formatRules'
import { validateSeedPositions } from '../core/seeding/validateSeeds'
import { computeCategoryDrawSeed } from './ensureDraft'
import { serializePublishedStructure } from '../core/snapshot'
import { structureWithDerivedResult } from '../deriveCategoryPlacements'
import { resetPublicationStatesAbsentFromSnapshot, upsertPublicationPointer } from './publicationState'

async function publishActiveInPlace(input: { draftId: string; expectedVersion: number }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          await lockBoutsPageSetting(tx)
          const regState = await lockRegistrationState(tx)
          const draft = await lockDraftForMutation(tx, input.draftId, input.expectedVersion)

          const errors = await validateDraftForPublish(tx, draft.id, regState.revision)
          if (errors.length > 0) throw new PublishValidationError(errors)

          await freezeSnapshots(tx, draft.id)
          await freezeSystemVersions(tx, draft.id)
          await freezeStructureSnapshots(tx, draft.id)

          const publishedDraws = await tx.bracketCategoryDraw.findMany({
            where: { generationId: draft.id, status: 'ACTIVE' },
          })
          for (const draw of publishedDraws) {
            await upsertPublicationPointer(tx, draw.categoryKey, draw.id, false)
          }
          await resetPublicationStatesAbsentFromSnapshot(
            tx,
            publishedDraws.map((draw) => draw.categoryKey),
          )

          const publishedAt = new Date()
          const updated = await tx.bracketGeneration.update({
            where: { id: draft.id },
            data: { version: draft.version + 1, publishedAt },
          })

          return {
            ok: true as const,
            publishedGenerationId: draft.id,
            publishedAt,
            draft: { id: updated.id, version: updated.version },
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      const { computeDiffForDraft } = await import('../dashboardDiff')
      const diff = await computeDiffForDraft(result.draft.id)
      const { flushAwardAnnouncerSyncIfDeferred } = await import('../../announcer/hooks/scheduleAwardSync')
      flushAwardAnnouncerSyncIfDeferred()
      const { scheduleMatAnnouncerSync } = await import('../../announcer/hooks/scheduleMatSync')
      scheduleMatAnnouncerSync()
      return { ...result, diff }
    } catch (error) {
      if (isSerializationFailure(error) && attempt < 2) continue
      throw error
    }
  }
  throw new Error('Не удалось зафиксировать сетки после повторных попыток')
}

async function loadSettings() {
  const s = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  return s ?? { includePaid: true, includeUnpaid: false }
}

export async function validateDraftForPublish(
  tx: Prisma.TransactionClient,
  draftId: string,
  currentRevision: bigint,
) {
  const errors: Array<{ code: string; message: string; categoryKey?: string }> = []
  const draft = await tx.bracketGeneration.findUnique({
    where: { id: draftId },
    include: {
      categories: { include: { participants: { orderBy: { seedPosition: 'asc' } } } },
    },
  })
  if (!draft) return [{ code: 'DRAFT_NOT_FOUND', message: 'Черновик не найден' }]

  if (draft.sourceRevision !== currentRevision) {
    errors.push({
      code: 'DRAFT_STALE',
      message: 'Регистрация изменилась — обновите весь состав',
    })
  }

  const settings = await loadSettings()
  const eligible = await loadEligibleEntries({
    includePaid: settings.includePaid,
    includeUnpaid: settings.includeUnpaid,
  })
  const currentSourceFingerprint = computeSourceCompositionFingerprint(eligible)
  if (currentSourceFingerprint !== draft.sourceFingerprint) {
    errors.push({
      code: 'DRAFT_STALE',
      message: 'Состав устарел — обновите весь состав',
    })
  }

  const placements = await tx.bracketEntryPlacement.findMany()
  const placementMap = new Map(placements.map((p) => [p.entryId, p]))

  const diff = computeDraftDiff(
    eligible,
    draft.sourceRevision,
    draft.sourceFingerprint,
    currentRevision,
    draft.categories.map((c) => ({
      categoryKey: c.categoryKey,
      sourceFingerprint: c.sourceFingerprint,
      seedingFingerprint: c.seedingFingerprint,
      drawInputFingerprint: c.drawInputFingerprint,
      drawPolicyId: c.drawPolicyId,
      drawPolicyVersion: c.drawPolicyVersion,
      autoSystemId: c.autoSystemId,
      systemOverride: c.systemOverride,
      systemVersion: c.systemVersion,
      participants: c.participants.map((p) => {
        const e = eligible.find((x) => x.entryId === p.entryId)
        return {
          entryId: p.entryId,
          displayName: e?.displayName ?? '',
          seedPosition: p.seedPosition,
          clubIdentity: e?.clubIdentity ?? '',
          strengthTier: e?.strengthTier ?? null,
          clubKey: e?.clubKey ?? null,
          cityKey: e?.cityKey ?? null,
          seedLocked: p.seedLocked,
        }
      }),
    })),
    placementMap,
  )

  const formatRules = await tx.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
  const activeEntryDraws = new Map<string, string>()

  for (const cat of draft.categories) {
    if (cat.status === 'UNSUPPORTED') {
      errors.push({
        code: 'UNSUPPORTED_CATEGORY',
        message: 'Категория не поддерживается',
        categoryKey: cat.categoryKey,
      })
    }

    if (cat.status === 'ACTIVE') {
      const effectiveSystemId = getEffectiveSystemId(cat.autoSystemId, cat.systemOverride)
      if (!effectiveSystemId) {
        errors.push({
          code: 'INVALID_ACTIVE_SYSTEM',
          message: 'Активная категория без системы проведения',
          categoryKey: cat.categoryKey,
        })
      } else {
        const system = BracketSystemRegistry.tryGetLatest(effectiveSystemId)
        const n = cat.participants.length
        const rule = resolveFormatRule(n, formatRules)
        if (rule && !rule.allowedSystemIds.includes(effectiveSystemId)) {
          errors.push({
            code: 'INVALID_SYSTEM_FOR_N',
            message: `Система «${formatSystemLabel(effectiveSystemId)}» недопустима для ${n} участников`,
            categoryKey: cat.categoryKey,
          })
        }
        if (system) {
          if (n > system.maxParticipants) {
            errors.push({
              code: 'EXCEEDS_MAX_PARTICIPANTS',
              message: `Превышен лимит ${system.maxParticipants}`,
              categoryKey: cat.categoryKey,
            })
          }
          const bronze = getEffectiveBronzeMode(cat.autoBronzeMode, cat.bronzeModeOverride)
          errors.push(
            ...system.validateCategory(n, { bronzeMode: bronze }).map((i) => ({
              code: i.code,
              message: i.message,
              categoryKey: cat.categoryKey,
            })),
          )
        }
      }

      const catDiff = diff.categories[cat.categoryKey]
      if (catDiff?.compositionStale) {
        errors.push({
          code: 'DRAFT_STALE',
          message: 'Состав категории устарел',
          categoryKey: cat.categoryKey,
        })
      }
      if (catDiff?.seedingStale) {
        errors.push({
          code: 'SEEDING_STALE',
          message: 'Жеребьёвка устарела — выполните жеребьёвку',
          categoryKey: cat.categoryKey,
        })
      }
      if (catDiff?.balanceStale) {
        errors.push({
          code: 'BALANCE_STALE',
          message: 'Баланс жеребьёвки устарел — выполните жеребьёвку',
          categoryKey: cat.categoryKey,
        })
      }

      for (const p of cat.participants) {
        if (activeEntryDraws.has(p.entryId)) {
          errors.push({
            code: 'DUPLICATE_ENTRY',
            message: 'Участник в нескольких активных категориях',
            categoryKey: cat.categoryKey,
          })
        }
        activeEntryDraws.set(p.entryId, cat.categoryKey)

        const placement = placementMap.get(p.entryId)
        if (placement && placement.categoryKey !== cat.categoryKey) {
          errors.push({
            code: 'PLACEMENT_MISMATCH',
            message: 'Размещение участника не совпадает с сеткой',
            categoryKey: cat.categoryKey,
          })
        }

        const e = eligible.find((x) => x.entryId === p.entryId)
        if (!e || !e.displayName.trim()) {
          errors.push({
            code: 'MISSING_SNAPSHOT_DATA',
            message: 'Нет данных для снимка участника',
            categoryKey: cat.categoryKey,
          })
        }
      }

      const seedValidation = validateSeedPositions(
        cat.participants.map((participant) => participant.seedPosition),
        cat.participants.length,
      )
      if (seedValidation) {
        errors.push({
          code: seedValidation.code,
          message: seedValidation.message,
          categoryKey: cat.categoryKey,
        })
      }
    }
  }

  return errors
}

async function freezeSnapshots(tx: Prisma.TransactionClient, draftId: string) {
  const settings = await loadSettings()
  const eligible = await loadEligibleEntries({
    includePaid: settings.includePaid,
    includeUnpaid: settings.includeUnpaid,
  })
  const eligibleMap = new Map(eligible.map((e) => [e.entryId, e]))

  const draws = await tx.bracketCategoryDraw.findMany({
    where: { generationId: draftId },
    include: { participants: true },
  })

  for (const draw of draws) {
    for (const p of draw.participants) {
      const e = eligibleMap.get(p.entryId)
      await tx.bracketDrawParticipant.update({
        where: { id: p.id },
        data: {
          snapshotDisplayName: e?.displayName ?? null,
          snapshotClubName: e?.clubName ?? null,
          snapshotCity: e?.city ?? null,
          snapshotPublicNumber: e?.publicNumber ?? null,
        },
      })
    }
  }
}

async function freezeStructureSnapshots(tx: Prisma.TransactionClient, draftId: string) {
  const draws = await tx.bracketCategoryDraw.findMany({
    where: { generationId: draftId, status: 'ACTIVE' },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
  })

  for (const draw of draws) {
    const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    if (!effectiveSystemId || draw.systemVersion == null) continue
    const system = BracketSystemRegistry.get(effectiveSystemId, draw.systemVersion)
    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
    const built = system.build({
      participants: draw.participants.map((participant) => ({
        entryId: participant.entryId,
        displayName: participant.snapshotDisplayName ?? '',
        clubName: participant.snapshotClubName ?? '',
        city: participant.snapshotCity ?? '',
        clubIdentity: `${participant.snapshotClubName ?? ''}::${participant.snapshotCity ?? ''}`,
        publicNumber: participant.snapshotPublicNumber,
        seedPosition: participant.seedPosition,
        seedLocked: participant.seedLocked,
      })),
      drawSeed: draw.drawSeed,
      options: { bronzeMode },
    })

    const structure = structureWithDerivedResult(built, {
      systemId: system.id,
      bronzeMode,
      participantCount: draw.participants.length,
    })

    const serialized = serializePublishedStructure({
      systemId: system.id,
      systemVersion: system.version,
      structure,
    })

    await tx.bracketCategoryDraw.update({
      where: { id: draw.id },
      data: {
        publishedStructureJson: serialized as unknown as Prisma.InputJsonValue,
      },
    })

    const { notifyAwardCeremonyOnStructureFreeze } = await import('../../awards/hooks')
    await notifyAwardCeremonyOnStructureFreeze({
      tx,
      categoryKey: draw.categoryKey,
      publishedStructureJson: serialized,
      participants: draw.participants,
      systemId: system.id,
    })
  }
}

async function freezeSystemVersions(tx: Prisma.TransactionClient, draftId: string) {
  const draws = await tx.bracketCategoryDraw.findMany({ where: { generationId: draftId } })
  for (const draw of draws) {
    if (draw.status !== 'ACTIVE') continue
    const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    if (!effectiveSystemId) continue
    const system = BracketSystemRegistry.getLatest(effectiveSystemId)
    await tx.bracketCategoryDraw.update({
      where: { id: draw.id },
      data: { systemVersion: system.version },
    })
  }
}

/** Commits publication pointers and snapshots in-place on the ACTIVE singleton. */
export async function publishBracketDraft(input: {
  draftId: string
  expectedVersion: number
}) {
  return publishActiveInPlace(input)
}
