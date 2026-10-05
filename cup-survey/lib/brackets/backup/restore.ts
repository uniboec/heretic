import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { prisma } from '../../prisma'
import { BracketOperationError } from '../core/errors'
import { BRACKET_MUTATION_TX_OPTIONS } from '../core/transactionOptions'
import { buildLockLevelsMap, getCategoryLockLevel, assertRestoreAllowed } from '../live/guard'
import { acquireBracketWriteLocks } from '../live/locks'
import { requireWorkingGeneration } from '../live/generation'
import type { BracketImpactResult } from '../live/impact'
import { stableJsonHash } from '../live/mutationFingerprint'
import {
  type BackupCategorySnapshot,
  type BackupParticipantSnapshot,
  type BackupSnapshotV1,
  parseBackupSnapshot,
} from './snapshot'

function categoryContentFingerprint(
  category: Pick<
    BackupCategorySnapshot,
    | 'categoryKey'
    | 'discipline'
    | 'title'
    | 'status'
    | 'statusReason'
    | 'autoSystemId'
    | 'systemOverride'
    | 'autoBronzeMode'
    | 'bronzeModeOverride'
    | 'systemVersion'
    | 'drawSeed'
    | 'redrawRevision'
    | 'sourceFingerprint'
    | 'seedingFingerprint'
    | 'drawPolicyId'
    | 'drawPolicyVersion'
    | 'drawInputFingerprint'
    | 'publishedStructureJson'
    | 'matIndex'
    | 'competitionStage'
  >,
  participants: Array<{
    entryId: string
    seedPosition: number
    seedLocked: boolean
    snapshotDisplayName: string | null
    snapshotClubName: string | null
    snapshotCity: string | null
    snapshotPublicNumber: number | null
  }>,
): string {
  return stableJsonHash({
    category,
    participants: [...participants]
      .map((participant) => ({
        entryId: participant.entryId,
        seedPosition: participant.seedPosition,
        seedLocked: participant.seedLocked,
        snapshotDisplayName: participant.snapshotDisplayName,
        snapshotClubName: participant.snapshotClubName,
        snapshotCity: participant.snapshotCity,
        snapshotPublicNumber: participant.snapshotPublicNumber,
      }))
      .sort((a, b) => a.entryId.localeCompare(b.entryId)),
  })
}

function mapBackupCategoryToDrawData(
  category: BackupCategorySnapshot,
  generationId: string,
): Prisma.BracketCategoryDrawUncheckedCreateInput {
  return {
    generationId,
    categoryKey: category.categoryKey,
    discipline: category.discipline,
    title: category.title,
    status: category.status as Prisma.BracketCategoryDrawUncheckedCreateInput['status'],
    statusReason: category.statusReason as Prisma.BracketCategoryDrawUncheckedCreateInput['statusReason'],
    autoSystemId: category.autoSystemId,
    systemOverride: category.systemOverride,
    autoBronzeMode: category.autoBronzeMode as Prisma.BracketCategoryDrawUncheckedCreateInput['autoBronzeMode'],
    bronzeModeOverride:
      category.bronzeModeOverride as Prisma.BracketCategoryDrawUncheckedCreateInput['bronzeModeOverride'],
    systemVersion: category.systemVersion,
    drawSeed: category.drawSeed,
    redrawRevision: category.redrawRevision,
    sourceFingerprint: category.sourceFingerprint,
    seedingFingerprint: category.seedingFingerprint,
    drawPolicyId: category.drawPolicyId,
    drawPolicyVersion: category.drawPolicyVersion,
    drawInputFingerprint: category.drawInputFingerprint,
    publishedStructureJson: category.publishedStructureJson ?? Prisma.DbNull,
    matIndex: category.matIndex,
    competitionStage: category.competitionStage ?? 1,
  }
}

type LiveDrawForCompare = BackupCategorySnapshot & {
  participants: Array<{
    entryId: string
    seedPosition: number
    seedLocked: boolean
    snapshotDisplayName: string | null
    snapshotClubName: string | null
    snapshotCity: string | null
    snapshotPublicNumber: number | null
  }>
}

function toComparableDraw(
  draw: {
    id: string
    categoryKey: string
    discipline: string
    title: string
    status: string
    statusReason: string | null
    autoSystemId: string | null
    systemOverride: string | null
    autoBronzeMode: string | null
    bronzeModeOverride: string | null
    systemVersion: number | null
    drawSeed: string
    redrawRevision: number
    sourceFingerprint: string | null
    seedingFingerprint: string | null
    drawPolicyId: string | null
    drawPolicyVersion: number | null
    drawInputFingerprint: string | null
    publishedStructureJson: Prisma.JsonValue | null
    matIndex: number | null
    competitionStage: number
    participants: LiveDrawForCompare['participants']
  },
): LiveDrawForCompare {
  return {
    id: draw.id,
    categoryKey: draw.categoryKey,
    discipline: draw.discipline,
    title: draw.title,
    status: draw.status,
    statusReason: draw.statusReason,
    autoSystemId: draw.autoSystemId,
    systemOverride: draw.systemOverride,
    autoBronzeMode: draw.autoBronzeMode,
    bronzeModeOverride: draw.bronzeModeOverride,
    systemVersion: draw.systemVersion,
    drawSeed: draw.drawSeed,
    redrawRevision: draw.redrawRevision,
    sourceFingerprint: draw.sourceFingerprint,
    seedingFingerprint: draw.seedingFingerprint,
    drawPolicyId: draw.drawPolicyId,
    drawPolicyVersion: draw.drawPolicyVersion,
    drawInputFingerprint: draw.drawInputFingerprint,
    publishedStructureJson: draw.publishedStructureJson,
    matIndex: draw.matIndex,
    competitionStage: draw.competitionStage,
    participants: draw.participants,
  }
}

function computeAffectedCategoryKeys(
  snapshot: BackupSnapshotV1,
  liveDraws: LiveDrawForCompare[],
  participantsByBackupDrawId: Map<string, BackupParticipantSnapshot[]>,
): string[] {
  const backupKeys = new Set(snapshot.categories.map((category) => category.categoryKey))
  const liveByKey = new Map(liveDraws.map((draw) => [draw.categoryKey, draw]))
  const liveKeys = new Set(liveDraws.map((draw) => draw.categoryKey))

  const added = [...backupKeys].filter((key) => !liveKeys.has(key))
  const removed = [...liveKeys].filter((key) => !backupKeys.has(key))
  const changed = snapshot.categories
    .filter((category) => liveKeys.has(category.categoryKey))
    .filter((category) => {
      const liveDraw = liveByKey.get(category.categoryKey)!
      const backupParticipants = participantsByBackupDrawId.get(category.id) ?? []
      const backupFingerprint = categoryContentFingerprint(category, backupParticipants)
      const liveFingerprint = categoryContentFingerprint(liveDraw, liveDraw.participants)
      return backupFingerprint !== liveFingerprint
    })
    .map((category) => category.categoryKey)

  return [...new Set([...added, ...removed, ...changed])].sort()
}

export async function computeRestoreImpact(
  tx: Prisma.TransactionClient,
  backupId: string,
): Promise<BracketImpactResult> {
  const generation = await requireWorkingGeneration(tx)
  const backupRow = await tx.bracketBackup.findUnique({ where: { id: backupId } })
  if (!backupRow) {
    throw new BracketOperationError('BACKUP_NOT_FOUND', 'Бэкап не найден')
  }

  const snapshot = parseBackupSnapshot(backupRow.snapshot)
  if (!snapshot) {
    throw new BracketOperationError('BACKUP_INVALID', 'Некорректный формат резервной копии')
  }

  const liveDraws = await tx.bracketCategoryDraw.findMany({
    where: { generationId: generation.id },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
    orderBy: { categoryKey: 'asc' },
  })
  const participantsByBackupDrawId = new Map<string, BackupParticipantSnapshot[]>()
  for (const participant of snapshot.participants) {
    const list = participantsByBackupDrawId.get(participant.drawId) ?? []
    list.push(participant)
    participantsByBackupDrawId.set(participant.drawId, list)
  }

  const affectedCategoryKeys = computeAffectedCategoryKeys(
    snapshot,
    liveDraws.map(toComparableDraw),
    participantsByBackupDrawId,
  )
  const publicationStates = await tx.bracketPublicationState.findMany({
    where: { categoryKey: { in: affectedCategoryKeys } },
  })

  return {
    affectedCategoryKeys,
    lockLevels: buildLockLevelsMap(affectedCategoryKeys, publicationStates),
    liveGenerationId: generation.id,
    liveGenerationVersion: generation.version,
    mutationFingerprint: stableJsonHash({ backupId }),
  }
}

export async function restoreBracketBackup(input: {
  backupId: string
  expectedVersion: number
  impactToken: string
}): Promise<{
  ok: true
  generation: { id: string; version: number }
  affectedCategoryKeys: string[]
}> {
  return prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, {
      scope: 'destructive_admin',
    })
    const liveGen = ctx.generation

    if (liveGen.version !== input.expectedVersion) {
      const { VersionConflictError } = await import('../core/errors')
      throw new VersionConflictError()
    }

    const { verifyImpactTokenUnderLock } = await import('../live/commitImpact')
    await verifyImpactTokenUnderLock(tx, {
      impactToken: input.impactToken,
      expectedOperation: 'restore_backup',
      computeActual: (innerTx) => computeRestoreImpact(innerTx, input.backupId),
    })

    const backupRow = await tx.bracketBackup.findUnique({ where: { id: input.backupId } })
    if (!backupRow) {
      throw new BracketOperationError('BACKUP_NOT_FOUND', 'Бэкап не найден')
    }

    const snapshot = parseBackupSnapshot(backupRow.snapshot)
    if (!snapshot) {
      throw new BracketOperationError('BACKUP_INVALID', 'Некорректный формат резервной копии')
    }

    const liveDraws = await tx.bracketCategoryDraw.findMany({
      where: { generationId: liveGen.id },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
      orderBy: { categoryKey: 'asc' },
    })
    const liveDrawByKey = new Map(liveDraws.map((draw) => [draw.categoryKey, draw]))
    const participantsByBackupDrawId = new Map<string, BackupParticipantSnapshot[]>()
    for (const participant of snapshot.participants) {
      const list = participantsByBackupDrawId.get(participant.drawId) ?? []
      list.push(participant)
      participantsByBackupDrawId.set(participant.drawId, list)
    }

    const affectedCategoryKeys = computeAffectedCategoryKeys(
      snapshot,
      liveDraws.map(toComparableDraw),
      participantsByBackupDrawId,
    )

    const releasedAffected = affectedCategoryKeys.filter((categoryKey) => {
      const publicationState = ctx.publicationStates.find((state) => state.categoryKey === categoryKey)
      return publicationState && getCategoryLockLevel(publicationState) !== 'OPEN'
    })
    assertRestoreAllowed(releasedAffected)

    const operationalByKey = new Map(
      ctx.publicationStates.map((state) => [
        state.categoryKey,
        {
          visible: state.visible,
          boutsReleased: state.boutsReleased,
          boutMatAssignments: state.boutMatAssignments,
          matCountAtRelease: state.matCountAtRelease,
        },
      ]),
    )

    const backupKeys = new Set(snapshot.categories.map((category) => category.categoryKey))
    const liveKeys = new Set(liveDraws.map((draw) => draw.categoryKey))
    const removed = [...liveKeys].filter((key) => !backupKeys.has(key))

    for (const categoryKey of removed) {
      const liveDraw = liveDrawByKey.get(categoryKey)
      if (!liveDraw) continue
      const publicationState = await tx.bracketPublicationState.findUnique({ where: { categoryKey } })
      if (publicationState?.publishedDrawId === liveDraw.id) {
        await tx.bracketPublicationState.delete({ where: { categoryKey } })
      }
      await tx.bracketCategoryDraw.delete({ where: { id: liveDraw.id } })
    }

    for (const backupCategory of snapshot.categories) {
      const liveDraw = liveDrawByKey.get(backupCategory.categoryKey)
      const backupParticipants = participantsByBackupDrawId.get(backupCategory.id) ?? []
      let targetDrawId: string

      if (liveDraw) {
        targetDrawId = liveDraw.id
        await tx.bracketCategoryDraw.update({
          where: { id: liveDraw.id },
          data: mapBackupCategoryToDrawData(backupCategory, liveGen.id),
        })
        await tx.bracketDrawParticipant.deleteMany({ where: { drawId: liveDraw.id } })
      } else {
        const conflictingDraw = await tx.bracketCategoryDraw.findUnique({
          where: { id: backupCategory.id },
        })
        targetDrawId = conflictingDraw ? randomUUID() : backupCategory.id
        await tx.bracketCategoryDraw.create({
          data: {
            id: targetDrawId,
            ...mapBackupCategoryToDrawData(backupCategory, liveGen.id),
          },
        })
      }

      for (const participant of backupParticipants) {
        await tx.bracketDrawParticipant.create({
          data: {
            drawId: targetDrawId,
            entryId: participant.entryId,
            seedPosition: participant.seedPosition,
            seedLocked: participant.seedLocked,
            snapshotDisplayName: participant.snapshotDisplayName,
            snapshotClubName: participant.snapshotClubName,
            snapshotCity: participant.snapshotCity,
            snapshotPublicNumber: participant.snapshotPublicNumber,
          },
        })
      }

      const operational = operationalByKey.get(backupCategory.categoryKey)
      const existingPublication = await tx.bracketPublicationState.findUnique({
        where: { categoryKey: backupCategory.categoryKey },
      })

      if (existingPublication) {
        await tx.bracketPublicationState.update({
          where: { categoryKey: backupCategory.categoryKey },
          data: {
            publishedDrawId: targetDrawId,
            visible: operational?.visible ?? existingPublication.visible,
            boutsReleased: operational?.boutsReleased ?? existingPublication.boutsReleased,
            boutMatAssignments:
              operational?.boutMatAssignments ?? existingPublication.boutMatAssignments ?? Prisma.DbNull,
            matCountAtRelease:
              operational?.matCountAtRelease ?? existingPublication.matCountAtRelease,
          },
        })
      } else {
        await tx.bracketPublicationState.create({
          data: {
            categoryKey: backupCategory.categoryKey,
            publishedDrawId: targetDrawId,
            visible: operational?.visible ?? false,
            boutsReleased: operational?.boutsReleased ?? false,
            boutMatAssignments: operational?.boutMatAssignments ?? Prisma.DbNull,
            matCountAtRelease: operational?.matCountAtRelease ?? null,
          },
        })
      }
    }

    await tx.bracketEntryPlacement.deleteMany()
    for (const placement of snapshot.placements) {
      await tx.bracketEntryPlacement.create({
        data: {
          entryId: placement.entryId,
          categoryKey: placement.categoryKey,
          isManualMove: placement.isManualMove,
          movedAt: placement.movedAt ? new Date(placement.movedAt) : null,
        },
      })
    }

    const updated = await tx.bracketGeneration.update({
      where: { id: liveGen.id },
      data: {
        baseSeed: snapshot.generation.baseSeed,
        sourceRevision: snapshot.generation.sourceRevision
          ? BigInt(snapshot.generation.sourceRevision)
          : null,
        sourceFingerprint: snapshot.generation.sourceFingerprint,
        version: liveGen.version + 1,
      },
    })

    return {
      ok: true,
      generation: { id: updated.id, version: updated.version },
      affectedCategoryKeys,
    }
  }, BRACKET_MUTATION_TX_OPTIONS)
}
